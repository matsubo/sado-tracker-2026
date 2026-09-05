import { afterEach, describe, expect, it, vi } from "vitest";
import { projectKm } from "@/hooks/useLivePosition";
import type { PositionDto } from "@/lib/api/contract";
import { replayClock, systemClock } from "@/lib/runtime/clock";
import { hasRaceClock, raceNow, resetRaceClock, setRaceClockOffset } from "@/lib/runtime/raceClock";

afterEach(() => {
  resetRaceClock();
  vi.useRealTimers();
});

const position: PositionDto = {
  discipline: "bike",
  lastCheckpointLabel: "住吉",
  lastKm: 100,
  lastAt: Date.parse("2025-09-07T11:38:00+09:00"),
  speedKmh: 30,
  capKm: 190,
  estKm: 130,
  totalKm: 190,
  waiting: false,
  inTransition: false,
  source: "own",
};

describe("race clock", () => {
  it("reports itself unknown until a server time arrives", () => {
    expect(hasRaceClock()).toBe(false);
    expect(raceNow()).toBe(0);
  });

  it("adopts the server's time, so replay and clock skew both track correctly", () => {
    const serverNow = Date.parse("2025-09-07T13:38:00+09:00");
    setRaceClockOffset(serverNow);
    expect(Math.abs(raceNow() - serverNow)).toBeLessThan(50);
  });

  it("ignores a nonsensical server time", () => {
    setRaceClockOffset(Number.NaN);
    expect(hasRaceClock()).toBe(false);
    expect(raceNow()).toBe(0);
  });

  it("holds the server estimate for the moment before the clock is known", () => {
    // Reproduces the flash where every leader briefly showed the next timing
    // point: the projection ran on the device clock before the first response.
    expect(projectKm(position, raceNow())).toBe(position.estKm);
    setRaceClockOffset(position.lastAt + 60 * 60 * 1000);
    expect(projectKm(position, raceNow())).toBeCloseTo(130, 0);
  });
});

describe("projectKm on the race clock", () => {
  it("keeps the server estimate before the clock is known", () => {
    expect(projectKm(position, 0)).toBe(130);
  });

  it("advances two hours of riding, not a year of it", () => {
    const twoHoursLater = position.lastAt + 2 * 60 * 60 * 1000;
    expect(projectKm(position, twoHoursLater)).toBeCloseTo(160, 5);
  });

  it("never projects past the next timing point", () => {
    const muchLater = position.lastAt + 40 * 60 * 60 * 1000;
    expect(projectKm(position, muchLater)).toBeCloseTo(189.9, 5);
  });

  it("would have pinned every rider to the next timing point on a device clock", () => {
    // The failure this guards against: a 2026 device clock projecting a 2025
    // replay position pushes every athlete to the cap and piles them up.
    const deviceNow = Date.parse("2026-09-05T19:00:00+09:00");
    expect(projectKm(position, deviceNow)).toBeCloseTo(189.9, 5);
    const serverNow = position.lastAt + 90 * 60 * 1000;
    expect(projectKm(position, serverNow)).toBeCloseTo(145, 5);
  });
});

describe("replay clock", () => {
  it("loops back to the start rather than sitting on a finished race", () => {
    const start = "2025-09-07T06:00:00+09:00";
    const startMs = Date.parse(start);
    const realNow = Date.now();
    // 420x, a fourteen-hour window: one loop takes two real minutes.
    const clock = replayClock(start, 420, { windowMs: 14 * 3_600_000, realNow });

    vi.useFakeTimers();
    vi.setSystemTime(realNow + 60_000);
    expect(clock.now() - startMs).toBeCloseTo(7 * 3_600_000, -3);

    vi.setSystemTime(realNow + 130_000);
    // Past the end of the window, so back near the start of the race.
    expect(clock.now() - startMs).toBeLessThan(2 * 3_600_000);
    expect(clock.now()).toBeGreaterThanOrEqual(startMs);
  });

  it("reports its speed so the server can extrapolate between refreshes", () => {
    expect(replayClock("2025-09-07T06:00:00+09:00", 60).speed).toBe(60);
    expect(systemClock.speed).toBe(1);
  });

  it("rejects a start time it cannot read", () => {
    expect(() => replayClock("not a date", 60)).toThrow(/REPLAY_START/);
  });
});
