import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { getRaceConfig, HISTORY_YEARS } from "@/config/races";
import type { BacktestTable } from "@/lib/compute/prediction";
import { computeSnapshot } from "@/lib/compute/snapshot";
import { decodeCp932 } from "@/lib/csv/decode";
import { fetchCsv } from "@/lib/csv/fetch";
import { toSnapshot } from "@/lib/csv/normalize";
import { parseCsv } from "@/lib/csv/parse";
import type { RaceSnapshot } from "@/lib/domain/types";
import { runBacktest } from "@/lib/history/backtest";
import { buildNeighbourModel, type NeighbourModel } from "@/lib/history/model";
import { buildNameIndex, type HistoryYear, type NameIndex } from "@/lib/history/nameIndex";
import { getWeather } from "@/lib/weather";
import { type Clock, clockFromEnv } from "./clock";
import { logger } from "./logger";
import { claimPollerStart, markStale, setSnapshot } from "./store";

const POLL_INTERVAL_MS = 60_000;
const WEATHER_INTERVAL_MS = 300_000;

function dataDir(): string {
  return process.env.DATA_DIR ?? ".data";
}

function raceYear(): number {
  const year = Number(process.env.RACE_YEAR ?? "2026");
  return Number.isFinite(year) ? year : 2026;
}

function readCsvFile(path: string): string {
  const buffer = readFileSync(path);
  return decodeCp932(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
}

/**
 * Load past races from disk, downloading any that are missing. They are the
 * training set for the prediction and the source of past-result lookups.
 */
async function loadHistory(liveYear: number): Promise<HistoryYear[]> {
  const years: HistoryYear[] = [];

  // Never train on, or match against, the race being displayed: in replay
  // mode the live year is also a past year, and an athlete would otherwise
  // be shown their own result as a previous year and used as their own
  // nearest neighbour.
  for (const year of HISTORY_YEARS.filter((candidate) => candidate !== liveYear)) {
    const path = `${dataDir()}/history/${year}.csv`;
    try {
      if (!existsSync(path)) {
        const config = getRaceConfig(year);
        const buffer = await fetchCsv(config.csvUrl);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, Buffer.from(buffer));
        logger.info("Downloaded past race", { year, bytes: buffer.byteLength });
      }
      const config = getRaceConfig(year);
      const snapshot = toSnapshot(
        parseCsv(readCsvFile(path)),
        config,
        Date.parse(`${config.raceDate}T23:59:59+09:00`),
      );
      years.push({ year, snapshot, config });
    } catch (error) {
      logger.error("Could not load past race", { year, error: String(error) });
    }
  }

  return years;
}

interface Runtime {
  readonly clock: Clock;
  readonly model: NeighbourModel;
  readonly nameIndex: NameIndex;
  readonly backtest: BacktestTable;
}

async function fetchLive(year: number): Promise<RaceSnapshot> {
  const config = getRaceConfig(year);

  // Replay mode reads a finished race from disk and reveals it gradually.
  if (process.env.REPLAY_START) {
    return toSnapshot(
      parseCsv(readCsvFile(`${dataDir()}/history/${year}.csv`)),
      config,
      Date.now(),
    );
  }

  const buffer = await fetchCsv(config.csvUrl);
  return toSnapshot(parseCsv(decodeCp932(buffer)), config, Date.now());
}

/** Hide checkpoints that have not happened yet in the replayed timeline. */
function applyReplayCutoff(snapshot: RaceSnapshot, nowMs: number): RaceSnapshot {
  return {
    ...snapshot,
    athletes: snapshot.athletes.map((athlete) => ({
      ...athlete,
      passes: Object.fromEntries(Object.entries(athlete.passes).filter(([, at]) => at <= nowMs)),
      preRace: Object.fromEntries(Object.entries(athlete.preRace).filter(([, at]) => at <= nowMs)),
    })),
  };
}

async function refresh(runtime: Runtime): Promise<void> {
  const year = raceYear();
  const config = getRaceConfig(year);

  try {
    const raw = await fetchLive(year);
    const nowMs = runtime.clock.now();
    const visible = runtime.clock.replay ? applyReplayCutoff(raw, nowMs) : raw;

    const computed = computeSnapshot(visible, config, runtime.model, runtime.nameIndex, nowMs, {
      replay: runtime.clock.replay,
      backtest: runtime.backtest,
    });
    setSnapshot(computed);

    logger.info("Snapshot refreshed", {
      year,
      athletes: computed.athletes.size,
      finishedA: computed.counts.A.finish ?? 0,
      finishedB: computed.counts.B.finish ?? 0,
    });
  } catch (error) {
    markStale();
    logger.error("Snapshot refresh failed, keeping the previous one", {
      year,
      error: String(error),
    });
  }
}

/** Start the background pollers exactly once per process. */
export async function startPollers(): Promise<void> {
  if (!claimPollerStart()) return;

  const clock = clockFromEnv();
  const year = raceYear();
  logger.info("Starting pollers", { year, replay: clock.replay });

  const history = await loadHistory(year);
  const model = buildNeighbourModel(history, getRaceConfig(year));
  const nameIndex = buildNameIndex(history);
  const holdout = history.map((entry) => entry.year).sort((a, b) => b - a)[0];
  const backtest =
    history.length >= 2 && holdout !== undefined ? runBacktest(history, holdout) : new Map();

  const runtime: Runtime = { clock, model, nameIndex, backtest };

  await refresh(runtime);
  setInterval(() => void refresh(runtime), POLL_INTERVAL_MS);

  void getWeather();
  setInterval(() => void getWeather(), WEATHER_INTERVAL_MS);
}
