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
import { raceYear } from "@/lib/runtime/year";
import { getWeather } from "@/lib/weather";
import { type Clock, clockFromEnv } from "./clock";
import { logger, logOnce } from "./logger";
import {
  claimPollerStart,
  getPollerRuntime,
  getSnapshot,
  markStale,
  setPollerRuntime,
  setSnapshot,
} from "./store";

const DEFAULT_POLL_INTERVAL_MS = 60_000;
const MIN_POLL_INTERVAL_MS = 500;
const WEATHER_INTERVAL_MS = 300_000;

/**
 * How often the field is recomputed. The live race is polled once a minute,
 * which is as fast as the timing site publishes. A replay reads from disk, so
 * it can run far faster and needs to when a whole race is compressed into a
 * couple of minutes.
 */
export function pollIntervalMs(env: NodeJS.ProcessEnv = process.env): number {
  const configured = Number(env.POLL_INTERVAL_MS);
  if (Number.isFinite(configured) && configured >= MIN_POLL_INTERVAL_MS) return configured;
  if (!env.REPLAY_START) return DEFAULT_POLL_INTERVAL_MS;

  // Keep roughly one frame per five minutes of race time in replay.
  const speed = Number(env.REPLAY_SPEED ?? "60");
  const perFrame = (5 * 60_000) / (Number.isFinite(speed) && speed > 0 ? speed : 60);
  return Math.max(MIN_POLL_INTERVAL_MS, Math.min(DEFAULT_POLL_INTERVAL_MS, Math.round(perFrame)));
}

function dataDir(): string {
  return process.env.DATA_DIR ?? ".data";
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * The window in which the timing site is worth asking. Outside it the race is
 * either hours away or long over, and every request is load on someone else's
 * server for a file that will not have changed.
 *
 * Both ends are hours of the race day in Asia/Tokyo, inclusive of the start
 * and exclusive of the end. Set FETCH_WINDOW to "off" to poll around the
 * clock, which is what replay and local development do.
 */
export function fetchWindow(env: Partial<NodeJS.ProcessEnv> = process.env): {
  readonly fromHour: number;
  readonly toHour: number;
} | null {
  if ((env.FETCH_WINDOW ?? "").toLowerCase() === "off") return null;
  if (env.REPLAY_START) return null;

  const fromHour = Number(env.FETCH_FROM_HOUR ?? "7");
  const toHour = Number(env.FETCH_TO_HOUR ?? "23");
  if (!Number.isFinite(fromHour) || !Number.isFinite(toHour)) return null;
  return { fromHour, toHour };
}

/**
 * True when the timing site should be asked right now: the race day, between
 * the first wave and the cut-off. The date comes from the year's own config,
 * so nothing has to be reset for the next edition.
 */
export function shouldFetch(
  raceDate: string,
  nowMs: number,
  env: Partial<NodeJS.ProcessEnv> = process.env,
): boolean {
  const window = fetchWindow(env);
  if (!window) return true;

  const tokyo = new Date(nowMs + JST_OFFSET_MS);
  const day = tokyo.toISOString().slice(0, 10);
  if (day !== raceDate) return false;

  const hour = tokyo.getUTCHours();
  return hour >= window.fromHour && hour < window.toHour;
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

async function refresh(runtime: Runtime, force = false): Promise<void> {
  const year = raceYear();
  const config = getRaceConfig(year);
  const nowMs = runtime.clock.now();

  // Always fetch once, whatever the hour: a server started outside the window
  // would otherwise serve nothing at all, including the entry list.
  const outsideWindow =
    !force && getSnapshot() !== null && !shouldFetch(config.raceDate, Date.now());

  if (outsideWindow) {
    logOnce(
      `outside-window:${new Date(Date.now() + JST_OFFSET_MS).toISOString().slice(0, 13)}`,
      "Outside the fetch window, leaving the snapshot as it is",
      { raceDate: config.raceDate },
    );

    // Recompute anyway so estimated positions and the clock keep moving from
    // the records already held, without asking the timing site again.
    const held = getSnapshot();
    if (held) {
      const computed = computeSnapshot(held.raw, config, runtime.model, runtime.nameIndex, nowMs, {
        replay: runtime.clock.replay,
        backtest: runtime.backtest,
        pollIntervalMs: pollIntervalMs(),
        clockSpeed: runtime.clock.speed,
      });
      setSnapshot(computed);
    }
    return;
  }

  try {
    const raw = await fetchLive(year);
    const visible = runtime.clock.replay ? applyReplayCutoff(raw, nowMs) : raw;

    const computed = computeSnapshot(visible, config, runtime.model, runtime.nameIndex, nowMs, {
      replay: runtime.clock.replay,
      backtest: runtime.backtest,
      pollIntervalMs: pollIntervalMs(),
      clockSpeed: runtime.clock.speed,
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

/**
 * Fetch now, whatever the hour. Exposed so an operator can pull the current
 * records outside the window, which is the only way to seed a server started
 * before the race or restarted after it.
 */
export async function refreshNow(): Promise<boolean> {
  const runtime = getPollerRuntime<Runtime>();
  if (!runtime) return false;
  await refresh(runtime, true);
  return true;
}

/** Start the background pollers exactly once per process. */
export async function startPollers(): Promise<void> {
  if (!claimPollerStart()) return;

  const clock = clockFromEnv();
  const year = raceYear();
  logger.info("Starting pollers", { year, replay: clock.replay });

  const history = await loadHistory(year);
  const liveConfig = getRaceConfig(year);
  const model = buildNeighbourModel(history, liveConfig);
  const nameIndex = buildNameIndex(history);
  const holdout = history.map((entry) => entry.year).sort((a, b) => b - a)[0];
  // The measured accuracy has to come from the same feature set the live
  // model uses, or it describes predictions nobody is being shown.
  const backtest =
    history.length >= 2 && holdout !== undefined
      ? runBacktest(history, holdout, liveConfig)
      : new Map();

  const runtime: Runtime = { clock, model, nameIndex, backtest };
  setPollerRuntime(runtime);

  await refresh(runtime, true);
  const interval = pollIntervalMs();
  logger.info("Poll interval chosen", { intervalMs: interval, replay: clock.replay });

  // Chain rather than use a fixed interval: a refresh that runs long must not
  // stack up behind itself when the replay is fast.
  const tick = async (): Promise<void> => {
    await refresh(runtime);
    setTimeout(() => void tick(), interval);
  };
  setTimeout(() => void tick(), interval);

  void getWeather();
  setInterval(() => void getWeather(), WEATHER_INTERVAL_MS);
}
