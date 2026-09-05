import { describe, expect, it } from "vitest";
import { getRaceConfig } from "@/config/races";
import { buildPopulations } from "@/lib/compute/population";
import { predictFinish } from "@/lib/compute/prediction";
import type { Athlete } from "@/lib/domain/types";
import { runBacktest } from "@/lib/history/backtest";
import { buildNeighbourModel } from "@/lib/history/model";
import type { HistoryYear } from "@/lib/history/nameIndex";
import { loadFixtureSnapshot } from "@/lib/testing/fixtures";

const YEARS: HistoryYear[] = [2023, 2024, 2025].map((year) => ({
  year,
  snapshot: loadFixtureSnapshot(year, Date.parse(`${year}-09-30T00:00:00+09:00`)),
  config: getRaceConfig(year),
}));

const config = getRaceConfig(2026);
const model = buildNeighbourModel(YEARS, config);
const courseA = config.divisions.A;
const courseB = config.divisions.B;
const START = Date.parse("2026-09-06T06:00:00+09:00");
const MIN = 60_000;
const HOUR = 60 * MIN;

function athlete(
  bib: string,
  passes: Record<string, number>,
  extra: Partial<Athlete> = {},
): Athlete {
  return {
    bib,
    name: `選手　${bib}`,
    nameKey: `選手 ${bib}`,
    sex: "M",
    division: "A",
    ageGroup: { id: "M40-44", sex: "M", min: 40, max: 44, label: "男子40-44" },
    startAt: START,
    startInferred: false,
    passes,
    preRace: { waterEntry: START - MIN },
    officialTotal: null,
    remark: "",
    ...extra,
  };
}

describe("buildNeighbourModel", () => {
  it("trains on every finisher of the usable years", () => {
    expect(model.rows.A.length).toBeGreaterThan(1500);
    expect(model.rows.B.length).toBeGreaterThan(1500);
  });

  it("compares the B swim by within-year percentile because the 2025 course was shortened", () => {
    expect(model.features.B).toEqual(["bike", "run"]);
    expect(model.percentileFeatures.B).toEqual(["swim"]);
  });

  it("compares the A swim on absolute pace because the distance never changed", () => {
    expect(model.features.A).toContain("swim");
    expect(model.percentileFeatures.A).toEqual([]);
  });

  it("ranks every finisher within their own year", () => {
    const withPercentile = model.rows.B.filter((r) => r.percentile.swim !== undefined);
    expect(withPercentile.length).toBeGreaterThan(1000);
    for (const row of withPercentile) {
      expect(row.percentile.swim).toBeGreaterThanOrEqual(0);
      expect(row.percentile.swim).toBeLessThanOrEqual(1);
    }
  });

  it("derives a plausible median speed for each discipline", () => {
    expect(model.medianSpeedKmh.A.bike).toBeGreaterThan(20);
    expect(model.medianSpeedKmh.A.bike).toBeLessThan(35);
    expect(model.medianSpeedKmh.A.run).toBeGreaterThan(5);
    expect(model.medianSpeedKmh.A.run).toBeLessThan(12);
  });
});

describe("predictFinish", () => {
  const now = START + 4 * HOUR + 42 * MIN;
  const midBike = athlete("1", {
    swimF: START + 84 * MIN,
    bikeS: START + 92 * MIN,
    sumiyoshi: START + 4 * HOUR + 12 * MIN,
  });
  const pop = buildPopulations([midBike], "A", courseA, now);

  it("uses nearest neighbours once a checkpoint has been passed", () => {
    const prediction = predictFinish(midBike, courseA, pop, model, now);
    expect(prediction?.method).toBe("neighbours");
    expect(prediction?.atCheckpoint).toBe("sumiyoshi");
    expect(prediction?.explanation.neighbourCount).toBe(20);
  });

  it("brackets the prediction with the neighbour quartiles", () => {
    const prediction = predictFinish(midBike, courseA, pop, model, now);
    expect(prediction?.rangeLowMs).toBeLessThanOrEqual(prediction?.totalMs as number);
    expect(prediction?.rangeHighMs).toBeGreaterThanOrEqual(prediction?.totalMs as number);
  });

  it("predicts a plausible A finish time", () => {
    const prediction = predictFinish(midBike, courseA, pop, model, now);
    const hours = (prediction?.totalMs as number) / HOUR;
    expect(hours).toBeGreaterThan(8);
    expect(hours).toBeLessThan(17);
  });

  it("reports the year mix and both speeds so the reader can judge it", () => {
    const explanation = predictFinish(midBike, courseA, pop, model, now)?.explanation;
    expect(Object.keys(explanation?.yearBreakdown ?? {}).length).toBeGreaterThan(1);
    expect(explanation?.ownSpeedKmh).toBeGreaterThan(10);
    expect(explanation?.neighbourSpeedKmh).toBeGreaterThan(10);
    expect(explanation?.extrapolationMs).toBeGreaterThan(0);
    expect(explanation?.note.length).toBeGreaterThan(10);
  });

  it("never predicts a slower finish for a faster athlete at the same point", () => {
    const fast = athlete("f", {
      swimF: START + 70 * MIN,
      bikeS: START + 76 * MIN,
      sumiyoshi: START + 3 * HOUR + 20 * MIN,
    });
    const slow = athlete("s", {
      swimF: START + 100 * MIN,
      bikeS: START + 110 * MIN,
      sumiyoshi: START + 5 * HOUR + 30 * MIN,
    });
    const p = buildPopulations([fast, slow], "A", courseA, now + 2 * HOUR);
    const fastPrediction = predictFinish(fast, courseA, p, model, now + 2 * HOUR);
    const slowPrediction = predictFinish(slow, courseA, p, model, now + 2 * HOUR);
    expect(fastPrediction?.totalMs).toBeLessThan(slowPrediction?.totalMs as number);
  });

  it("predicts a plausible B finish using the swim as a percentile", () => {
    const bStart = Date.parse("2026-09-06T07:30:00+09:00");
    const b = athlete(
      "3001",
      {
        swimF: bStart + 25 * MIN,
        bikeS: bStart + 33 * MIN,
        sumiyoshi: bStart + 78 * MIN,
      },
      { division: "B", startAt: bStart, preRace: { waterEntry: bStart - MIN } },
    );
    const bPop = buildPopulations([b], "B", courseB, bStart + 2 * HOUR);
    const prediction = predictFinish(b, courseB, bPop, model, bStart + 2 * HOUR);
    expect(prediction?.method).toBe("neighbours");
    const hours = (prediction?.totalMs as number) / HOUR;
    expect(hours).toBeGreaterThan(4);
    expect(hours).toBeLessThan(10);
  });

  it("returns nothing before the first checkpoint", () => {
    const fresh = athlete("9", {});
    const p = buildPopulations([fresh], "A", courseA, START + 10 * MIN);
    expect(predictFinish(fresh, courseA, p, model, START + 10 * MIN)).toBeNull();
  });

  it("returns nothing for a finisher or a no-show", () => {
    const done = athlete("10", { runS: START + 8 * HOUR, finish: START + 13 * HOUR });
    const absent = athlete("11", {}, { preRace: {} });
    const p = buildPopulations([done, absent], "A", courseA, START + 14 * HOUR);
    expect(predictFinish(done, courseA, p, model, START + 14 * HOUR)).toBeNull();
    expect(predictFinish(absent, courseA, p, model, START + 14 * HOUR)).toBeNull();
  });
});

describe("runBacktest", () => {
  it("measures the method against a year it did not train on", () => {
    const table = runBacktest(YEARS, 2025);
    expect(table.size).toBeGreaterThan(4);

    const sumiyoshi = table.get("A:sumiyoshi");
    expect(sumiyoshi).toBeDefined();
    expect(Number.isFinite(sumiyoshi?.medianErrorMs as number)).toBe(true);
    expect(sumiyoshi?.within25MinPct).toBeGreaterThan(0);
    expect(sumiyoshi?.within25MinPct).toBeLessThanOrEqual(100);
    expect(sumiyoshi?.sampleSize).toBeGreaterThan(20);
  });

  it("gets more accurate the further along the course the prediction is made", () => {
    const table = runBacktest(YEARS, 2025);
    const early = table.get("A:sumiyoshi");
    const late = table.get("A:run30");
    if (!early || !late) return;
    expect(late.medianErrorMs).toBeLessThan(early.medianErrorMs);
  });
});
