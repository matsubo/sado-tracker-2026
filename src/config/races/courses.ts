import type { CheckpointDef, DivisionCourse } from "../types";

/**
 * Header spellings differ between years: the parentheses around 本部 are
 * full-width in 2024-2026 and half-width in 2022-2023.
 */
const RUN_START_HEADERS = ["ﾗﾝS（本部）", "ﾗﾝS(本部)"] as const;

/** Run checkpoints are named after the kilometre they sit at. */
function runCheckpoint(km: number): CheckpointDef {
  return {
    id: `run${km}`,
    label: `ラン${km}km`,
    csvHeaders: [`ﾗﾝ${km}km`],
    discipline: "run",
    km,
  };
}

const START: CheckpointDef = {
  id: "start",
  label: "START",
  csvHeaders: ["START", "ｽﾀｰﾄ"],
  discipline: "swim",
  km: 0,
};

const BIKE_START: CheckpointDef = {
  id: "bikeS",
  label: "バイクS",
  csvHeaders: ["ﾊﾞｲｸS"],
  discipline: "bike",
  km: 0,
};

/**
 * 住吉 is the only intermediate bike timing point. Its distance is not
 * published, so it is inferred from the median split ratio of finishers:
 * 0.53 of the A bike leg and 0.16-0.20 of the B bike leg.
 */
const SUMIYOSHI_A: CheckpointDef = {
  id: "sumiyoshi",
  label: "住吉",
  csvHeaders: ["住吉"],
  discipline: "bike",
  km: 100,
  inferred: true,
};

const SUMIYOSHI_B: CheckpointDef = {
  id: "sumiyoshi",
  label: "住吉",
  csvHeaders: ["住吉"],
  discipline: "bike",
  km: 18,
  inferred: true,
};

interface CourseOptions {
  readonly swimKm: number;
  readonly swimTimesComparable?: boolean;
  /**
   * The wave start, "HH:MM" in JST. The organiser moves it on the day when
   * the sea demands it, so every year states its own rather than inheriting
   * a default that would silently be wrong.
   */
  readonly waveStart?: string;
}

/** A and RA share the long course: 4 km swim, 190 km bike, 42.2 km run. */
export function longCourse({
  swimKm,
  swimTimesComparable = true,
  waveStart = "06:00",
}: CourseOptions): DivisionCourse {
  return {
    swimKm,
    bikeKm: 190,
    runKm: 42.2,
    waveStart,
    swimCutoffMin: 150,
    swimTimesComparable,
    checkpoints: [
      START,
      { id: "swimL", label: "スイムL", csvHeaders: ["ｽｲﾑL"], discipline: "swim", km: swimKm / 2 },
      { id: "swimF", label: "スイムF", csvHeaders: ["ｽｲﾑF"], discipline: "swim", km: swimKm },
      BIKE_START,
      SUMIYOSHI_A,
      {
        id: "runS",
        label: "ランS（本部）",
        csvHeaders: [...RUN_START_HEADERS],
        discipline: "bike",
        km: 190,
      },
      ...[4, 9, 10, 14, 19, 20, 24, 29, 30, 34, 39].map(runCheckpoint),
      { id: "finish", label: "FINISH", csvHeaders: ["FINISH"], discipline: "run", km: 42.2 },
    ],
  };
}

/** B and RB share the middle course: 108 km bike, 21.1 km run. */
export function middleCourse({
  swimKm,
  swimTimesComparable = true,
  waveStart = "07:30",
}: CourseOptions): DivisionCourse {
  return {
    swimKm,
    bikeKm: 108,
    runKm: 21.1,
    waveStart,
    swimCutoffMin: 100,
    swimTimesComparable,
    checkpoints: [
      START,
      { id: "swimF", label: "スイムF", csvHeaders: ["ｽｲﾑF"], discipline: "swim", km: swimKm },
      BIKE_START,
      SUMIYOSHI_B,
      {
        id: "runS",
        label: "ランS（本部）",
        csvHeaders: [...RUN_START_HEADERS],
        discipline: "bike",
        km: 108,
      },
      ...[4, 9, 10, 14, 19].map(runCheckpoint),
      { id: "finish", label: "FINISH", csvHeaders: ["FINISH"], discipline: "run", km: 21.1 },
    ],
  };
}
