import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { getRaceConfig, HISTORY_YEARS, type RaceConfig } from "@/config/races";
import { type ComputeOptions, computeSnapshot } from "@/lib/compute/snapshot";
import { decodeCp932 } from "@/lib/csv/decode";
import { fetchCsv } from "@/lib/csv/fetch";
import { toSnapshot } from "@/lib/csv/normalize";
import { parseCsv } from "@/lib/csv/parse";
import type { RaceSnapshot } from "@/lib/domain/types";
import { runBacktest } from "@/lib/history/backtest";
import { buildNeighbourModel } from "@/lib/history/model";
import { buildNameIndex, type HistoryYear } from "@/lib/history/nameIndex";
import { JST_OFFSET_MS, raceEndsAt } from "@/lib/runtime/raceWindow";
import { raceYear } from "@/lib/runtime/year";
import { getWeather } from "@/lib/weather";
import { clockFromEnv } from "./clock";
import { logger, logOnce } from "./logger";
import {
  claimPollerStart,
  getPollerHandle,
  getSnapshot,
  markStale,
  setPollerHandle,
  setSnapshot,
} from "./store";
import type { PollerDeps, PollerRuntime } from "./types";

export type { PollerDeps, PollerRuntime } from "./types";

const DEFAULT_POLL_INTERVAL_MS = 60_000;
const MIN_POLL_INTERVAL_MS = 500;
const WEATHER_INTERVAL_MS = 300_000;

/** The real file system, network and clock; what production runs on. */
const nodeDeps: PollerDeps = {
  env: process.env,
  fetchCsv: (url) => fetchCsv(url),
  readFile: (path) => readFileSync(path),
  exists: (path) => existsSync(path),
  writeFile: (path, data) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, data);
  },
  wallClock: () => Date.now(),
};

/**
 * How often the field is recomputed. The live race is polled once a minute,
 * which is as fast as the timing site publishes. A replay reads from disk, so
 * it can run far faster and needs to when a whole race is compressed into a
 * couple of minutes.
 */
export function pollIntervalMs(env: Partial<NodeJS.ProcessEnv> = process.env): number {
  const configured = Number(env.POLL_INTERVAL_MS);
  if (Number.isFinite(configured) && configured >= MIN_POLL_INTERVAL_MS) return configured;
  if (!env.REPLAY_START) return DEFAULT_POLL_INTERVAL_MS;

  // Keep roughly one frame per five minutes of race time in replay.
  const speed = Number(env.REPLAY_SPEED ?? "60");
  const perFrame = (5 * 60_000) / (Number.isFinite(speed) && speed > 0 ? speed : 60);
  return Math.max(MIN_POLL_INTERVAL_MS, Math.min(DEFAULT_POLL_INTERVAL_MS, Math.round(perFrame)));
}

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

function historyPath(env: Partial<NodeJS.ProcessEnv>, year: number): string {
  return `${env.DATA_DIR ?? ".data"}/history/${year}.csv`;
}

/** A Node Buffer is a Uint8Array view, which the decoder takes as it is. */
function decodeFile(buffer: Buffer): string {
  return decodeCp932(buffer);
}

/**
 * Load past races from disk, downloading any that are missing unless
 * HISTORY_DOWNLOAD is off. They are the training set for the prediction and
 * the source of past-result lookups. A year that cannot be had is logged and
 * left out; the tracker still runs, with less to predict from.
 */
export async function loadHistory(liveYear: number, deps: PollerDeps): Promise<HistoryYear[]> {
  const download = (deps.env.HISTORY_DOWNLOAD ?? "").toLowerCase() !== "off";
  const years: HistoryYear[] = [];

  // Never train on, or match against, the race being displayed: in replay
  // mode the live year is also a past year, and an athlete would otherwise
  // be shown their own result as a previous year and used as their own
  // nearest neighbour.
  for (const year of HISTORY_YEARS.filter((candidate) => candidate !== liveYear)) {
    const path = historyPath(deps.env, year);
    const config = getRaceConfig(year);
    try {
      let bytes: Buffer;
      if (deps.exists(path)) {
        bytes = deps.readFile(path);
      } else if (download) {
        const buffer = await deps.fetchCsv(config.csvUrl);
        bytes = Buffer.from(buffer);
        deps.writeFile(path, bytes);
        logger.info("Downloaded past race", { year, bytes: buffer.byteLength });
      } else {
        logger.warn("Past race is not on disk and downloads are off", { year, path });
        continue;
      }
      const snapshot = toSnapshot(
        parseCsv(decodeFile(bytes)),
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

/** Build what every refresh needs: the clock, the model and the name index. */
export async function buildRuntime(deps: PollerDeps): Promise<PollerRuntime> {
  const clock = clockFromEnv(deps.env);
  const year = raceYear(deps.env);
  const history = await loadHistory(year, deps);
  const liveConfig = getRaceConfig(year);
  const holdout = history.map((entry) => entry.year).sort((a, b) => b - a)[0];
  // The measured accuracy has to come from the same feature set the live
  // model uses, or it describes predictions nobody is being shown.
  const backtest =
    history.length >= 2 && holdout !== undefined
      ? runBacktest(history, holdout, liveConfig)
      : new Map();

  return {
    clock,
    model: buildNeighbourModel(history, liveConfig),
    nameIndex: buildNameIndex(history),
    backtest,
    historyYears: history.map((entry) => entry.year),
  };
}

async function fetchLive(year: number, deps: PollerDeps): Promise<RaceSnapshot> {
  const config = getRaceConfig(year);

  // Replay mode reads a finished race from disk and reveals it gradually.
  if (deps.env.REPLAY_START) {
    const text = decodeFile(deps.readFile(historyPath(deps.env, year)));
    return toSnapshot(parseCsv(text), config, deps.wallClock());
  }

  const buffer = await deps.fetchCsv(config.csvUrl);
  return toSnapshot(parseCsv(decodeCp932(buffer)), config, deps.wallClock());
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

function computeOptions(
  runtime: PollerRuntime,
  deps: PollerDeps,
  config: RaceConfig,
): ComputeOptions {
  return {
    replay: runtime.clock.replay,
    backtest: runtime.backtest,
    pollIntervalMs: pollIntervalMs(deps.env),
    clockSpeed: runtime.clock.speed,
    raceEndedAt: raceEndsAt(config.raceDate, deps.env),
    historyYears: runtime.historyYears,
  };
}

/**
 * One refresh: fetch the records if the hour calls for it, then recompute.
 * Outside the fetch window the held records are recomputed so estimated
 * positions and the clock keep moving without asking the timing site.
 */
export async function refresh(
  runtime: PollerRuntime,
  deps: PollerDeps,
  force = false,
): Promise<void> {
  const year = raceYear(deps.env);
  const config = getRaceConfig(year);
  const nowMs = runtime.clock.now();
  const options = computeOptions(runtime, deps, config);
  const held = getSnapshot();

  // Always fetch once, whatever the hour: a server started outside the window
  // would otherwise serve nothing at all, including the entry list.
  const wallNow = deps.wallClock();
  if (!force && held !== null && !shouldFetch(config.raceDate, wallNow, deps.env)) {
    logOnce(
      `outside-window:${new Date(wallNow + JST_OFFSET_MS).toISOString().slice(0, 13)}`,
      "Outside the fetch window, leaving the snapshot as it is",
      { raceDate: config.raceDate },
    );
    setSnapshot(
      computeSnapshot(held.raw, config, runtime.model, runtime.nameIndex, nowMs, options),
    );
    return;
  }

  try {
    const raw = await fetchLive(year, deps);
    const visible = runtime.clock.replay ? applyReplayCutoff(raw, nowMs) : raw;
    const computed = computeSnapshot(
      visible,
      config,
      runtime.model,
      runtime.nameIndex,
      nowMs,
      options,
    );
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
  const handle = getPollerHandle();
  if (!handle) return false;
  await refresh(handle.runtime, handle.deps, true);
  return true;
}

/** Start the background pollers exactly once per process. */
export async function startPollers(deps: PollerDeps = nodeDeps): Promise<void> {
  if (!claimPollerStart()) return;

  const year = raceYear(deps.env);
  logger.info("Starting pollers", { year, replay: Boolean(deps.env.REPLAY_START) });

  const runtime = await buildRuntime(deps);
  setPollerHandle({ runtime, deps });
  logger.info("History loaded", { years: runtime.historyYears });

  await refresh(runtime, deps, true);
  const interval = pollIntervalMs(deps.env);
  logger.info("Poll interval chosen", { intervalMs: interval, replay: runtime.clock.replay });

  // Chain rather than use a fixed interval: a refresh that runs long must not
  // stack up behind itself when the replay is fast.
  const tick = async (): Promise<void> => {
    await refresh(runtime, deps);
    setTimeout(() => void tick(), interval);
  };
  setTimeout(() => void tick(), interval);

  void getWeather();
  setInterval(() => void getWeather(), WEATHER_INTERVAL_MS);
}
