import type { Division, DivisionCourse } from "@/config/races";
import type { Athlete } from "@/lib/domain/types";
import { athleteStatus, isScored, type Status } from "./status";

/** What one refresh has decided about an athlete, decided exactly once. */
export interface Standing {
  readonly athlete: Athlete;
  readonly status: Status;
  /** The furthest checkpoint reached, in course order; null before the first. */
  readonly latest: string | null;
}

export interface Populations {
  readonly division: Division;
  /** Everyone entered in this division, in bib order, whatever their status. */
  readonly standings: readonly Standing[];
  /** Scored athletes of this division, in bib order. */
  readonly all: readonly Athlete[];
  /**
   * The status decided for this athlete when the populations were built. Every
   * compute step reads this rather than deciding again, so the race end and
   * the clock are applied once and the same way everywhere.
   */
  statusOf(athlete: Athlete): Status;
  /** The furthest checkpoint the athlete has reached, decided the same way. */
  latestOf(athlete: Athlete): string | null;
  /** Athletes who have reached a checkpoint. */
  atCheckpoint(checkpointId: string): readonly Athlete[];
  /** Athletes who have reached a checkpoint and share a sex. */
  atCheckpointBySex(checkpointId: string, sex: "M" | "F"): readonly Athlete[];
  /** Athletes who have reached a checkpoint and share an age group. */
  atCheckpointByAgeGroup(checkpointId: string, ageGroupId: string): readonly Athlete[];
  /**
   * Ranks for a whole group at once, keyed by bib. Ranking each athlete
   * against the group separately is quadratic, and with a thousand athletes
   * over twenty checkpoints that dominated a refresh; this computes the
   * table once and every athlete reads their row out of it.
   */
  rankTable(
    cacheKey: string,
    group: readonly Athlete[],
    value: (athlete: Athlete) => number | null,
  ): ReadonlyMap<string, { rank: number; of: number }>;
}

/**
 * The furthest point along the course the athlete has reached. Course order
 * matters rather than timestamp order, because a late-published checkpoint
 * can carry an earlier time than one already recorded.
 */
export function latestCheckpoint(athlete: Athlete, course: DivisionCourse): string | null {
  for (let i = course.checkpoints.length - 1; i >= 0; i -= 1) {
    const checkpoint = course.checkpoints[i];
    if (!checkpoint) continue;
    if (checkpoint.id === "start") continue;
    if (athlete.passes[checkpoint.id] !== undefined) return checkpoint.id;
  }
  return null;
}

/** Index of a checkpoint within the course, or -1 when it is not on it. */
export function checkpointIndex(course: DivisionCourse, checkpointId: string): number {
  return course.checkpoints.findIndex((c) => c.id === checkpointId);
}

/**
 * Group one division's athletes by checkpoint so every rank can be taken
 * against the exact set of athletes who have been measured there, and decide
 * each athlete's status once, with the race end in hand.
 */
export function buildPopulations(
  athletes: readonly Athlete[],
  division: Division,
  course: DivisionCourse,
  nowMs: number,
  raceEndedAt: number | null = null,
): Populations {
  const decide = (athlete: Athlete): Standing => ({
    athlete,
    status: athleteStatus(athlete, course, nowMs, raceEndedAt),
    latest: latestCheckpoint(athlete, course),
  });

  const standings = athletes.filter((a) => a.division === division).map(decide);
  const scored = standings.filter((s) => isScored(s.status)).map((s) => s.athlete);

  // Keyed by identity, not bib: a backtest asks about a copy of an athlete
  // with later checkpoints hidden, and that copy must be judged on what it
  // carries. An unknown object is decided on the spot with the same inputs,
  // so the answer stays consistent with everyone else's.
  const decided = new WeakMap<Athlete, Standing>(standings.map((s) => [s.athlete, s]));
  const standingOf = (athlete: Athlete): Standing => decided.get(athlete) ?? decide(athlete);

  const byCheckpoint = new Map<string, Athlete[]>();
  for (const checkpoint of course.checkpoints) {
    if (checkpoint.id === "start") continue;
    byCheckpoint.set(
      checkpoint.id,
      scored.filter((a) => a.passes[checkpoint.id] !== undefined),
    );
  }

  const sexCache = new Map<string, Athlete[]>();
  const ageCache = new Map<string, Athlete[]>();
  const rankCache = new Map<string, ReadonlyMap<string, { rank: number; of: number }>>();

  return {
    division,
    standings,
    all: scored,
    statusOf: (athlete) => standingOf(athlete).status,
    latestOf: (athlete) => standingOf(athlete).latest,
    atCheckpoint: (id) => byCheckpoint.get(id) ?? [],
    atCheckpointBySex: (id, sex) => {
      const key = `${id}:${sex}`;
      const cached = sexCache.get(key);
      if (cached) return cached;
      const value = (byCheckpoint.get(id) ?? []).filter((a) => a.sex === sex);
      sexCache.set(key, value);
      return value;
    },
    atCheckpointByAgeGroup: (id, ageGroupId) => {
      const key = `${id}:${ageGroupId}`;
      const cached = ageCache.get(key);
      if (cached) return cached;
      const value = (byCheckpoint.get(id) ?? []).filter((a) => a.ageGroup?.id === ageGroupId);
      ageCache.set(key, value);
      return value;
    },
    rankTable: (cacheKey, group, value) => {
      const cached = rankCache.get(cacheKey);
      if (cached) return cached;

      const measured: { bib: string; value: number }[] = [];
      for (const athlete of group) {
        const own = value(athlete);
        if (own !== null) measured.push({ bib: athlete.bib, value: own });
      }
      measured.sort((a, b) => a.value - b.value);

      // Standard competition ranking: ties share a rank and the next skips.
      const table = new Map<string, { rank: number; of: number }>();
      let rank = 0;
      let previous = Number.NaN;
      measured.forEach((entry, index) => {
        if (entry.value !== previous) {
          rank = index + 1;
          previous = entry.value;
        }
        table.set(entry.bib, { rank, of: measured.length });
      });

      rankCache.set(cacheKey, table);
      return table;
    },
  };
}
