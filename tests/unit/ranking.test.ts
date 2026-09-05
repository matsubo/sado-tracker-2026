import { describe, expect, it } from "vitest";
import { getRaceConfig } from "@/config/races";
import { deviationScore } from "@/lib/compute/deviation";
import { buildPopulations } from "@/lib/compute/population";
import { cumulativeRanks, disciplineRanks, rankBy, splitRank } from "@/lib/compute/ranking";
import type { Athlete } from "@/lib/domain/types";
import { loadFixtureSnapshot } from "@/lib/testing/fixtures";

const config = getRaceConfig(2026);
const courseA = config.divisions.A;
const START = Date.parse("2026-09-06T06:00:00+09:00");
const MIN = 60_000;

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

describe("rankBy", () => {
  const items = [{ v: 10 }, { v: 20 }, { v: 20 }, { v: 30 }];

  it("shares a rank on a tie and skips the next", () => {
    expect(rankBy(items, (i) => i.v, items[1] as { v: number })).toEqual({ rank: 2, of: 4 });
    expect(rankBy(items, (i) => i.v, items[2] as { v: number })).toEqual({ rank: 2, of: 4 });
    expect(rankBy(items, (i) => i.v, items[3] as { v: number })).toEqual({ rank: 4, of: 4 });
  });

  it("ranks the fastest first", () => {
    expect(rankBy(items, (i) => i.v, items[0] as { v: number })).toEqual({ rank: 1, of: 4 });
  });

  it("returns null when the target is not in the list", () => {
    expect(rankBy(items, (i) => i.v, { v: 99 })).toBeNull();
  });
});

describe("disciplineRanks", () => {
  const now = START + 300 * MIN;
  const fast = athlete("1", {
    swimF: START + 80 * MIN,
    bikeS: START + 88 * MIN,
    sumiyoshi: START + 250 * MIN,
  });
  const slow = athlete("2", {
    swimF: START + 95 * MIN,
    bikeS: START + 103 * MIN,
    sumiyoshi: START + 270 * MIN,
  });
  const swimOnly = athlete("3", { swimF: START + 90 * MIN });
  const pop = buildPopulations([fast, slow, swimOnly], "A", courseA, now);

  it("ranks a completed discipline against everyone who completed it", () => {
    const result = disciplineRanks(fast, "swim", pop, courseA);
    expect(result.provisional).toBe(false);
    expect(result.ranks.division).toEqual({ rank: 1, of: 3 });
  });

  it("marks an in-progress discipline provisional and names the checkpoint", () => {
    const result = disciplineRanks(fast, "bike", pop, courseA);
    expect(result.provisional).toBe(true);
    expect(result.atCheckpoint).toBe("sumiyoshi");
    expect(result.ranks.division).toEqual({ rank: 1, of: 2 });
  });

  it("returns no rank for a discipline the athlete has not entered", () => {
    const result = disciplineRanks(swimOnly, "run", pop, courseA);
    expect(result.ranks.division).toBeNull();
  });

  it("gives a relay athlete a division rank but no sex or age rank", () => {
    const relay = athlete(
      "4",
      { swimF: START + 85 * MIN },
      { sex: null, ageGroup: null, division: "RA" },
    );
    const relayPop = buildPopulations([relay], "RA", config.divisions.RA, now);
    const result = disciplineRanks(relay, "swim", relayPop, config.divisions.RA);
    expect(result.ranks.division).toEqual({ rank: 1, of: 1 });
    expect(result.ranks.sex).toBeNull();
    expect(result.ranks.ageGroup).toBeNull();
  });
});

describe("cumulativeRanks", () => {
  const now = START + 300 * MIN;
  const a = athlete("1", { swimF: START + 80 * MIN, bikeS: START + 88 * MIN });
  const b = athlete("2", { swimF: START + 95 * MIN, bikeS: START + 100 * MIN });
  const pop = buildPopulations([a, b], "A", courseA, now);

  it("ranks by elapsed time at each checkpoint the athlete has passed", () => {
    const history = cumulativeRanks(a, pop, courseA);
    expect(history.map((h) => h.checkpointId)).toEqual(["swimF", "bikeS"]);
    expect(history[0]?.ranks.division).toEqual({ rank: 1, of: 2 });
  });

  it("includes the age-group rank when the athlete has one", () => {
    const history = cumulativeRanks(a, pop, courseA);
    expect(history[0]?.ranks.ageGroup).toEqual({ rank: 1, of: 2 });
  });
});

describe("splitRank", () => {
  const now = START + 300 * MIN;
  const a = athlete("1", { bikeS: START + 88 * MIN, sumiyoshi: START + 250 * MIN });
  const b = athlete("2", { bikeS: START + 90 * MIN, sumiyoshi: START + 240 * MIN });
  const pop = buildPopulations([a, b], "A", courseA, now);

  it("ranks the segment itself, not the cumulative time", () => {
    expect(splitRank(b, "bikeS", "sumiyoshi", pop)).toEqual({ rank: 1, of: 2 });
    expect(splitRank(a, "bikeS", "sumiyoshi", pop)).toEqual({ rank: 2, of: 2 });
  });
});

describe("deviationScore", () => {
  it("gives 60 to a value one standard deviation faster than the mean", () => {
    const values = [10, 20, 20, 20, 30];
    expect(deviationScore(values, 20 - Math.sqrt(40))).toBeCloseTo(60, 5);
  });

  it("gives 50 at the mean", () => {
    expect(deviationScore([10, 20, 30, 40, 50], 30)).toBeCloseTo(50, 5);
  });

  it("hides the score when fewer than five athletes have been measured", () => {
    expect(deviationScore([10, 20, 30, 40], 20)).toBeNull();
  });

  it("hides the score when everyone recorded the same time", () => {
    expect(deviationScore([20, 20, 20, 20, 20], 20)).toBeNull();
  });
});

describe("ranking against the real 2025 field", () => {
  it("puts the published winner first and counts the whole division", () => {
    const snapshot = loadFixtureSnapshot(2025);
    const course = getRaceConfig(2025).divisions.A;
    const after = Date.parse("2025-09-07T23:00:00+09:00");
    const pop = buildPopulations(
      snapshot.athletes.filter((a) => a.division === "A"),
      "A",
      course,
      after,
    );

    const finishers = pop.atCheckpoint("finish");
    expect(finishers).toHaveLength(565);

    const fastest = [...finishers].sort(
      (x, y) => (x.passes.finish as number) - x.startAt - ((y.passes.finish as number) - y.startAt),
    )[0] as Athlete;
    expect(rankBy(finishers, (a) => (a.passes.finish as number) - a.startAt, fastest)).toEqual({
      rank: 1,
      of: 565,
    });
  });
});
