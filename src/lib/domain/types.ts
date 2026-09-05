import type { AgeGroup, Division, Sex } from "@/config/races";

/** Timing points recorded before the race that are not part of the course. */
export interface PreRacePasses {
  readonly reception?: number;
  readonly briefing?: number;
  readonly waterEntry?: number;
}

export interface Athlete {
  readonly bib: string;
  /** Name exactly as published, with the source's full-width space. */
  readonly name: string;
  /** Name with a single ASCII space, used for cross-year matching. */
  readonly nameKey: string;
  readonly sex: Sex | null;
  readonly division: Division;
  readonly ageGroup: AgeGroup | null;
  /** Wave start in epoch milliseconds. */
  readonly startAt: number;
  /** True when START was blank and the configured wave start was used. */
  readonly startInferred: boolean;
  /** Checkpoint id to epoch milliseconds, only for points actually reached. */
  readonly passes: Readonly<Record<string, number>>;
  readonly preRace: PreRacePasses;
  /** The 総合記録 column, when the year publishes one. */
  readonly officialTotal: string | null;
  readonly remark: string;
}

export interface RaceSnapshot {
  readonly year: number;
  readonly fetchedAt: number;
  readonly athletes: readonly Athlete[];
}
