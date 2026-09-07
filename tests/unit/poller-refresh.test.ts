import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toRaceState } from "@/lib/api/serialize";
import { buildRuntime, loadHistory, type PollerDeps, refresh } from "@/lib/runtime/poller";
import { getSnapshot, resetStore } from "@/lib/runtime/store";

const SAMPLE = readFileSync("tests/fixtures/sample-2026.csv");
const HISTORY_2025 = readFileSync("tests/fixtures/history-2025.csv");
/** Entries in the sample export once reserve and blank rows are dropped. */
const SAMPLE_ENTRIES = 10;

const toArrayBuffer = (buffer: Buffer): ArrayBuffer =>
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;

const NIGHT_BEFORE = Date.parse("2026-09-05T20:00:00+09:00");
const RACE_MORNING = Date.parse("2026-09-06T10:00:00+09:00");

function deps(over: Partial<PollerDeps> = {}): PollerDeps {
  return {
    env: { HISTORY_DOWNLOAD: "off" },
    fetchCsv: vi.fn(async () => toArrayBuffer(SAMPLE)),
    readFile: vi.fn(() => SAMPLE),
    exists: vi.fn(() => false),
    writeFile: vi.fn(),
    wallClock: () => NIGHT_BEFORE,
    ...over,
  };
}

beforeEach(() => {
  resetStore();
  // The poller reports failures on stderr; the tests below cause some on purpose.
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});
afterEach(() => vi.restoreAllMocks());

describe("refresh", () => {
  it("fetches on the first refresh whatever the hour and publishes a snapshot", async () => {
    const d = deps();
    const runtime = await buildRuntime(d);
    await refresh(runtime, d, true);
    expect(d.fetchCsv).toHaveBeenCalledTimes(1);
    expect(getSnapshot()?.athletes.size).toBe(SAMPLE_ENTRIES);
    expect(getSnapshot()?.stale).toBe(false);
  });

  it("recomputes from the held records outside the window rather than asking again", async () => {
    const d = deps();
    const runtime = await buildRuntime(d);
    await refresh(runtime, d, true);
    const first = getSnapshot();
    await refresh(runtime, d);
    expect(d.fetchCsv).toHaveBeenCalledTimes(1);
    expect(getSnapshot()).not.toBe(first);
    expect(getSnapshot()?.athletes.size).toBe(SAMPLE_ENTRIES);
  });

  it("asks the timing site again inside the window on race day", async () => {
    const d = deps({ wallClock: () => RACE_MORNING });
    const runtime = await buildRuntime(d);
    await refresh(runtime, d, true);
    await refresh(runtime, d);
    expect(d.fetchCsv).toHaveBeenCalledTimes(2);
  });

  it("keeps the previous snapshot and marks it stale when a fetch fails", async () => {
    const fetchCsv = vi
      .fn<PollerDeps["fetchCsv"]>()
      .mockResolvedValueOnce(toArrayBuffer(SAMPLE))
      .mockRejectedValueOnce(new Error("HTTP 502"));
    const d = deps({ fetchCsv, wallClock: () => RACE_MORNING });
    const runtime = await buildRuntime(d);
    await refresh(runtime, d, true);
    await refresh(runtime, d);
    expect(getSnapshot()?.stale).toBe(true);
    expect(getSnapshot()?.athletes.size).toBe(SAMPLE_ENTRIES);
  });

  it("replays a finished race from disk, hiding what has not happened yet", async () => {
    const d = deps({
      env: {
        HISTORY_DOWNLOAD: "off",
        RACE_YEAR: "2026",
        REPLAY_START: "2026-09-06T06:30:00+09:00",
        REPLAY_SPEED: "1",
      },
    });
    const runtime = await buildRuntime(d);
    await refresh(runtime, d, true);
    const snapshot = getSnapshot();
    expect(d.fetchCsv).not.toHaveBeenCalled();
    expect(snapshot?.replay).toBe(true);
    const finisher = snapshot?.raw.athletes.find((a) => a.bib === "1001");
    expect(finisher).toBeDefined();
    expect(Object.keys(finisher?.passes ?? {})).toEqual([]);
  });
});

describe("loadHistory", () => {
  it("skips a missing year without downloading when HISTORY_DOWNLOAD is off", async () => {
    const d = deps();
    expect(await loadHistory(2026, d)).toEqual([]);
    expect(d.fetchCsv).not.toHaveBeenCalled();
  });

  it("downloads a missing year and caches it to disk otherwise", async () => {
    const d = deps({ env: {}, fetchCsv: vi.fn(async () => toArrayBuffer(HISTORY_2025)) });
    await loadHistory(2026, d);
    expect(d.fetchCsv).toHaveBeenCalledTimes(4);
    expect(d.writeFile).toHaveBeenCalledTimes(4);
  });

  it("reads a cached year from disk and never trains on the race being shown", async () => {
    const d = deps({
      exists: vi.fn((path: string) => path.endsWith("/2025.csv")),
      readFile: vi.fn(() => HISTORY_2025),
    });
    const years = await loadHistory(2026, d);
    expect(years.map((y) => y.year)).toEqual([2025]);
    expect(d.fetchCsv).not.toHaveBeenCalled();

    const shown = await loadHistory(2025, d);
    expect(shown).toEqual([]);
  });

  it("tells clients which past races the model was trained on", async () => {
    const d = deps({
      exists: vi.fn((path: string) => path.endsWith("/2025.csv")),
      readFile: vi.fn((path: string) => (path.endsWith("/2025.csv") ? HISTORY_2025 : SAMPLE)),
    });
    const runtime = await buildRuntime(d);
    await refresh(runtime, d, true);
    expect(toRaceState(getSnapshot() as never).historyYears).toEqual([2025]);
  });
});
