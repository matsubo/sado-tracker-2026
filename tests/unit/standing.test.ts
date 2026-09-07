import { describe, expect, it } from "vitest";
import { getRaceConfig } from "@/config/races";
import { buildPopulations } from "@/lib/compute/population";
import { estimatePosition, fieldOrder } from "@/lib/compute/position";
import { predictFinish } from "@/lib/compute/prediction";
import type { Athlete } from "@/lib/domain/types";
import { buildNeighbourModel } from "@/lib/history/model";
import type { HistoryYear } from "@/lib/history/nameIndex";
import { loadFixtureSnapshot } from "@/lib/testing/fixtures";

const config = getRaceConfig(2026);
const courseA = config.divisions.A;
const START = Date.parse("2026-09-06T06:00:00+09:00");
const MIN = 60_000;
const HOUR = 60 * MIN;
/** The hour the poller stops asking on race day, after which the file is final. */
const RACE_OVER = Date.parse("2026-09-06T23:00:00+09:00");

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

/** Reached 住吉 and then vanished from the file. */
const stopped = athlete("1", {
  swimF: START + 84 * MIN,
  bikeS: START + 92 * MIN,
  sumiyoshi: START + 4 * HOUR + 12 * MIN,
});
const finisher = athlete("2", {
  swimF: START + 80 * MIN,
  bikeS: START + 88 * MIN,
  sumiyoshi: START + 4 * HOUR,
  runS: START + 8 * HOUR,
  finish: START + 12 * HOUR,
});

/**
 * Status is decided once per athlete when the populations are built, with the
 * race end in hand. Every compute step then reads that decision instead of
 * re-deriving it without the race end, which used to leave an athlete who
 * had stopped racing with a finish prediction days after the race.
 */
describe("standing", () => {
  it("records each athlete's status and furthest checkpoint once", () => {
    const pop = buildPopulations([stopped, finisher], "A", courseA, START + 5 * HOUR);
    expect(pop.statusOf(stopped)).toBe("racing");
    expect(pop.latestOf(stopped)).toBe("sumiyoshi");
    expect(pop.statusOf(finisher)).toBe("finished");
    expect(pop.latestOf(finisher)).toBe("finish");
  });

  it("marks an unfinished athlete as retired once the race is over", () => {
    const pop = buildPopulations([stopped, finisher], "A", courseA, RACE_OVER, RACE_OVER);
    expect(pop.statusOf(stopped)).toBe("dnf");
    expect(pop.statusOf(finisher)).toBe("finished");
  });

  it("stops predicting a finish for an athlete the race end has retired", () => {
    const years: HistoryYear[] = [2023, 2024].map((year) => ({
      year,
      snapshot: loadFixtureSnapshot(year, Date.parse(`${year}-09-30T00:00:00+09:00`)),
      config: getRaceConfig(year),
    }));
    const model = buildNeighbourModel(years, config);
    const live = buildPopulations([stopped, finisher], "A", courseA, START + 5 * HOUR);
    expect(predictFinish(stopped, courseA, live, model)).not.toBeNull();

    const over = buildPopulations([stopped, finisher], "A", courseA, RACE_OVER, RACE_OVER);
    expect(predictFinish(stopped, courseA, over, model)).toBeNull();
  });

  it("keeps a retired athlete parked where they were last measured", () => {
    const over = buildPopulations([stopped, finisher], "A", courseA, RACE_OVER, RACE_OVER);
    const position = estimatePosition(stopped, courseA, over, RACE_OVER);
    expect(position.lastCheckpoint).toBe("sumiyoshi");
    expect(position.estKm).toBe(100);
    expect(position.speedKmh).toBe(0);
  });

  it("orders the field from the populations it was built from", () => {
    const pop = buildPopulations([stopped, finisher], "A", courseA, START + 5 * HOUR);
    expect(fieldOrder(pop, courseA)).toEqual(["2", "1"]);
  });
});
