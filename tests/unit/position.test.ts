import { describe, expect, it } from "vitest";
import { getRaceConfig } from "@/config/races";
import { buildPopulations } from "@/lib/compute/population";
import { estimatePosition, fieldOrder, projectKm } from "@/lib/compute/position";
import type { Athlete } from "@/lib/domain/types";

const config = getRaceConfig(2026);
const courseA = config.divisions.A;
const START = Date.parse("2026-09-06T06:00:00+09:00");
const MIN = 60_000;
const HOUR = 60 * MIN;

function athlete(bib: string, passes: Record<string, number>, extra: Partial<Athlete> = {}): Athlete {
  return {
    bib, name: `選手　${bib}`, nameKey: `選手 ${bib}`, sex: "M", division: "A",
    ageGroup: { id: "M40-44", sex: "M", min: 40, max: 44, label: "男子40-44" },
    startAt: START, startInferred: false, passes, preRace: { waterEntry: START - MIN },
    officialTotal: null, remark: "", ...extra,
  };
}

describe("projectKm", () => {
  it("advances at the given speed and stops short of the next checkpoint", () => {
    expect(projectKm(100, 32, 30 * MIN, 190)).toBeCloseTo(116, 5);
    expect(projectKm(100, 32, 10 * HOUR, 190)).toBeCloseTo(189.9, 5);
  });

  it("never moves backwards", () => {
    expect(projectKm(100, 32, -5 * MIN, 190)).toBe(100);
  });
});

describe("estimatePosition", () => {
  const now = START + 4 * HOUR + 42 * MIN;
  const midBike = athlete("1", {
    swimF: START + 84 * MIN,
    bikeS: START + 92 * MIN,
    sumiyoshi: START + 4 * HOUR + 12 * MIN,
  });
  const peer = athlete("2", {
    swimF: START + 84 * MIN,
    bikeS: START + 92 * MIN,
    sumiyoshi: START + 4 * HOUR + 20 * MIN,
  });
  const pop = buildPopulations([midBike, peer], "A", courseA, now);

  it("projects forward from the last checkpoint using the athlete's own speed", () => {
    const position = estimatePosition(midBike, courseA, pop, now);
    expect(position.discipline).toBe("bike");
    expect(position.lastCheckpoint).toBe("sumiyoshi");
    expect(position.lastKm).toBe(100);
    expect(position.source).toBe("own");
    expect(position.estKm).toBeGreaterThan(100);
    expect(position.estKm).toBeLessThan(140);
    expect(position.waiting).toBe(false);
  });

  it("caps at the next checkpoint and reports waiting once the projection runs past it", () => {
    const stale = estimatePosition(midBike, courseA, pop, now + 12 * HOUR);
    expect(stale.estKm).toBeCloseTo(courseA.bikeKm - 0.1, 5);
    expect(stale.waiting).toBe(true);
  });

  it("places an athlete between the swim finish and the bike start in transition", () => {
    const inT1 = athlete("3", { swimF: START + 84 * MIN });
    const position = estimatePosition(inT1, courseA, buildPopulations([inT1], "A", courseA, now), now);
    expect(position.discipline).toBe("bike");
    expect(position.estKm).toBe(0);
    expect(position.inTransition).toBe(true);
  });

  it("places a finisher at the end of the run", () => {
    const done = athlete("4", {
      swimF: START + 84 * MIN, bikeS: START + 92 * MIN, sumiyoshi: START + 4 * HOUR,
      runS: START + 8 * HOUR, finish: START + 13 * HOUR,
    });
    const position = estimatePosition(done, courseA, buildPopulations([done], "A", courseA, now), now);
    expect(position.discipline).toBe("run");
    expect(position.estKm).toBe(courseA.runKm);
    expect(position.waiting).toBe(false);
  });

  it("places an athlete who has not started at the beginning of the swim", () => {
    const waiting = athlete("5", {});
    const position = estimatePosition(waiting, courseA, buildPopulations([waiting], "A", courseA, START - HOUR), START - HOUR);
    expect(position.discipline).toBe("swim");
    expect(position.estKm).toBe(0);
  });

  it("falls back to the field median when the athlete has no speed of their own yet", () => {
    const justArrived = athlete("6", { swimF: START + 84 * MIN, bikeS: START + 92 * MIN });
    const others = [90, 91, 92, 93, 94].map((offset, i) =>
      athlete(String(10 + i), {
        bikeS: START + offset * MIN,
        sumiyoshi: START + 4 * HOUR + i * 5 * MIN,
      }),
    );
    const p = buildPopulations([justArrived, ...others], "A", courseA, now);
    const position = estimatePosition(justArrived, courseA, p, now);
    expect(position.source).toBe("live-median");
    expect(position.speedKmh).toBeGreaterThan(20);
  });

  it("falls back to the historical median when the field is too small to trust", () => {
    const first = athlete("20", { swimF: START + 84 * MIN, bikeS: START + 92 * MIN });
    const p = buildPopulations([first], "A", courseA, now);
    const position = estimatePosition(first, courseA, p, now, { bike: 30 });
    expect(position.source).toBe("history-median");
    expect(position.speedKmh).toBe(30);
  });
});

describe("fieldOrder", () => {
  const now = START + 6 * HOUR;
  const onRun = athlete("1", {
    swimF: START + 84 * MIN, bikeS: START + 92 * MIN,
    sumiyoshi: START + 3 * HOUR, runS: START + 5 * HOUR + 30 * MIN,
  });
  const slowBike = athlete("2", { swimF: START + 80 * MIN, bikeS: START + 88 * MIN, sumiyoshi: START + 3 * HOUR + 30 * MIN });
  const fastBike = athlete("3", { swimF: START + 82 * MIN, bikeS: START + 90 * MIN, sumiyoshi: START + 3 * HOUR + 10 * MIN });
  const noShow = athlete("4", {}, { preRace: {} });

  it("puts the athlete furthest along the course first, regardless of elapsed time", () => {
    const order = fieldOrder([slowBike, onRun, fastBike], courseA, now);
    expect(order[0]).toBe("1");
  });

  it("breaks a tie at the same checkpoint by elapsed time", () => {
    const order = fieldOrder([slowBike, fastBike], courseA, now);
    expect(order).toEqual(["3", "2"]);
  });

  it("leaves out suspected no-shows", () => {
    const order = fieldOrder([fastBike, noShow], courseA, now);
    expect(order).toEqual(["3"]);
  });

  it("puts finishers at the top, fastest first", () => {
    const slowFinish = athlete("5", { runS: START + 5 * HOUR, finish: START + 13 * HOUR });
    const fastFinish = athlete("6", { runS: START + 5 * HOUR, finish: START + 12 * HOUR });
    const order = fieldOrder([onRun, slowFinish, fastFinish], courseA, now + 10 * HOUR);
    expect(order.slice(0, 2)).toEqual(["6", "5"]);
  });
});
