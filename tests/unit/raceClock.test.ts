import { afterEach, describe, expect, it, vi } from "vitest";
import { projectKm } from "@/hooks/useLivePosition";
import type { PositionDto } from "@/lib/api/contract";
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
