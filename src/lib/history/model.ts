import type { Discipline, Division, RaceConfig } from "@/config/races";
import { disciplineKm, splitBetween } from "@/lib/compute/elapsed";
import { buildPopulations } from "@/lib/compute/population";
import type { Athlete } from "@/lib/domain/types";
import type { HistoryYear } from "./nameIndex";

/**
 * One past finisher, reduced to what the prediction needs: pace on each
 * discipline, elapsed time at every checkpoint, and the total.
 */
export interface TrainingRow {
  readonly year: number;
  readonly division: Division;
  /** Minutes per kilometre for each discipline. */
  readonly pace: Readonly<Partial<Record<Discipline, number>>>;
  /**
   * Rank of this athlete's pace within their own year and division, from 0
   * (fastest) to 1 (slowest). This is comparable across years even when the
   * course changed, so it carries the shortened 2025 B swim.
   */
  readonly percentile: Readonly<Partial<Record<Discipline, number>>>;
  /** Elapsed milliseconds at each checkpoint the athlete passed. */
  readonly elapsed: Readonly<Record<string, number>>;
  readonly totalMs: number;
}

export interface NeighbourModel {
  readonly rows: Readonly<Record<Division, readonly TrainingRow[]>>;
  /** Disciplines compared on absolute pace, per division. */
  readonly features: Readonly<Record<Division, readonly Discipline[]>>;
  /**
   * Disciplines compared on within-year percentile instead of absolute pace,
   * because the course changed between years. The 2025 B swim was shortened
   * to 1.35 km, so its pace cannot be compared with a 2.0 km swim, but the
   * athlete's standing within that year's field still carries their ability.
   */
  readonly percentileFeatures: Readonly<Record<Division, readonly Discipline[]>>;
  /** Pace percentile lookup for the live year, filled in at snapshot time. */
  readonly medianSpeedKmh: Readonly<Record<Division, Partial<Record<Discipline, number>>>>;
}

const DIVISIONS: readonly Division[] = ["A", "B", "RA", "RB"];
const ALL_DISCIPLINES: readonly Discipline[] = ["swim", "bike", "run"];

function paceMinPerKm(ms: number, km: number): number | null {
  if (ms <= 0 || km <= 0) return null;
  return ms / 60_000 / km;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

function rowFor(athlete: Athlete, year: number, division: Division, config: RaceConfig): TrainingRow | null {
  const course = config.divisions[division];
  const finish = athlete.passes.finish;
  if (finish === undefined) return null;

  const pace: Partial<Record<Discipline, number>> = {};
  for (const discipline of ALL_DISCIPLINES) {
    const bounds =
      discipline === "swim"
        ? (["start", "swimF"] as const)
        : discipline === "bike"
          ? (["bikeS", "runS"] as const)
          : (["runS", "finish"] as const);
    const ms = splitBetween(athlete, bounds[0], bounds[1]);
    if (ms === null) continue;
    const value = paceMinPerKm(ms, disciplineKm(discipline, course));
    if (value !== null) pace[discipline] = value;
  }

  const elapsed: Record<string, number> = {};
  for (const checkpoint of course.checkpoints) {
    if (checkpoint.id === "start") continue;
    const at = athlete.passes[checkpoint.id];
    if (at !== undefined) elapsed[checkpoint.id] = at - athlete.startAt;
  }

  return { year, division, pace, percentile: {}, elapsed, totalMs: finish - athlete.startAt };
}

/**
 * Build the training set from past races. Years whose checkpoint layout
 * differs too much are excluded by their config flag.
 */
export function buildNeighbourModel(
  years: readonly HistoryYear[],
  liveConfig: RaceConfig,
): NeighbourModel {
  const rows: Record<Division, TrainingRow[]> = { A: [], B: [], RA: [], RB: [] };
  // A discipline is comparable on absolute pace only when every year in play,
  // including the live one, ran the same distance. The 2025 B swim was
  // shortened to 1.35 km, so comparing its pace against a 2 km swim would be
  // a scale error rather than a measurement.
  const swimKm: Record<Division, Set<number>> = { A: new Set(), B: new Set(), RA: new Set(), RB: new Set() };
  const swimComparable: Record<Division, boolean> = { A: true, B: true, RA: true, RB: true };

  for (const division of DIVISIONS) {
    const live = liveConfig.divisions[division];
    swimKm[division].add(live.swimKm);
    if (!live.swimTimesComparable) swimComparable[division] = false;
  }

  for (const { year, snapshot, config } of years) {
    if (!config.usableForPrediction) continue;

    for (const division of DIVISIONS) {
      const course = config.divisions[division];
      swimKm[division].add(course.swimKm);
      if (!course.swimTimesComparable) swimComparable[division] = false;

      const pop = buildPopulations(snapshot.athletes, division, course, snapshot.fetchedAt);
      for (const athlete of pop.atCheckpoint("finish")) {
        const row = rowFor(athlete, year, division, config);
        if (row) rows[division].push(row);
      }
    }
  }

  // Rank every finisher's pace within their own year and division so a
  // discipline whose distance changed can still be compared across years.
  const withPercentiles: Record<Division, TrainingRow[]> = { A: [], B: [], RA: [], RB: [] };
  for (const division of DIVISIONS) {
    const byYear = new Map<number, TrainingRow[]>();
    for (const row of rows[division]) {
      const group = byYear.get(row.year);
      if (group) group.push(row);
      else byYear.set(row.year, [row]);
    }

    for (const group of byYear.values()) {
      const sortedBy: Partial<Record<Discipline, number[]>> = {};
      for (const discipline of ALL_DISCIPLINES) {
        sortedBy[discipline] = group
          .map((row) => row.pace[discipline])
          .filter((value): value is number => value !== undefined)
          .sort((a, b) => a - b);
      }

      for (const row of group) {
        const percentile: Partial<Record<Discipline, number>> = {};
        for (const discipline of ALL_DISCIPLINES) {
          const own = row.pace[discipline];
          const sorted = sortedBy[discipline];
          if (own === undefined || !sorted || sorted.length < 2) continue;
          let ahead = 0;
          for (const value of sorted) {
            if (value < own) ahead += 1;
            else break;
          }
          percentile[discipline] = ahead / (sorted.length - 1);
        }
        withPercentiles[division].push({ ...row, percentile });
      }
    }
  }

  const features: Record<Division, Discipline[]> = { A: [], B: [], RA: [], RB: [] };
  const percentileFeatures: Record<Division, Discipline[]> = { A: [], B: [], RA: [], RB: [] };
  const medianSpeedKmh: Record<Division, Partial<Record<Discipline, number>>> = {
    A: {}, B: {}, RA: {}, RB: {},
  };

  for (const division of DIVISIONS) {
    const swimUsable = swimComparable[division] && swimKm[division].size === 1;
    features[division] = ALL_DISCIPLINES.filter((d) => d !== "swim" || swimUsable);
    percentileFeatures[division] = swimUsable ? [] : ["swim"];
    for (const discipline of ALL_DISCIPLINES) {
      const paces = rows[division]
        .map((row) => row.pace[discipline])
        .filter((value): value is number => value !== undefined);
      const value = median(paces);
      if (value !== null && value > 0) medianSpeedKmh[division][discipline] = 60 / value;
    }
  }

  return { rows: withPercentiles, features, percentileFeatures, medianSpeedKmh };
}
