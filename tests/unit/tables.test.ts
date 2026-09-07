import { describe, expect, it } from "vitest";
import { getRaceConfig } from "@/config/races";
import { buildPopulations } from "@/lib/compute/population";
import { buildRankingTables, competitionRanks } from "@/lib/compute/tables";
import type { Athlete } from "@/lib/domain/types";

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

describe("competitionRanks", () => {
  it("shares a rank between ties and skips the next, in one pass over sorted times", () => {
    expect(competitionRanks([10, 20, 20, 30])).toEqual([1, 2, 2, 4]);
    expect(competitionRanks([])).toEqual([]);
  });
});

describe("buildRankingTables", () => {
  const now = START + 3 * 60 * MIN;
  const fast = athlete("1", { swimF: START + 80 * MIN, bikeS: START + 88 * MIN });
  const tiedA = athlete("2", { swimF: START + 90 * MIN, bikeS: START + 98 * MIN });
  const tiedB = athlete("3", { swimF: START + 90 * MIN, bikeS: START + 99 * MIN });
  const slow = athlete("4", { swimF: START + 95 * MIN });
  const stillSwimming = athlete("5", { swimL: START + 40 * MIN });
  const pop = buildPopulations([slow, tiedB, fast, tiedA, stillSwimming], "A", courseA, now);
  const tables = buildRankingTables(pop);

  it("lists everyone who completed the discipline, fastest first, with competition ranks", () => {
    expect(tables.swim.map((row) => [row.bib, row.rank])).toEqual([
      ["1", 1],
      ["2", 2],
      ["3", 2],
      ["4", 4],
    ]);
    expect(tables.swim[0]?.timeMs).toBe(80 * MIN);
  });

  it("leaves a discipline nobody has completed empty rather than failing", () => {
    expect(tables.bike).toEqual([]);
    expect(tables.run).toEqual([]);
    expect(tables.total).toEqual([]);
  });

  it("carries what a ranking row needs so a page is a slice, not a computation", () => {
    expect(tables.swim[1]).toEqual({
      bib: "2",
      name: "選手　2",
      ageGroupId: "M40-44",
      timeMs: 90 * MIN,
      rank: 2,
    });
  });
});
