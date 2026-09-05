import type { Discipline, DivisionCourse } from "@/config/races";
import type { Athlete } from "@/lib/domain/types";
import { disciplineEnd, disciplineStart, elapsedAt, splitBetween } from "./elapsed";
import { checkpointIndex, latestCheckpoint, type Populations } from "./population";

export interface Rank {
  readonly rank: number;
  /** Size of the population the rank was taken against (母数). */
  readonly of: number;
}

export interface RankSet {
  readonly division: Rank | null;
  readonly sex: Rank | null;
  readonly ageGroup: Rank | null;
}

const EMPTY_RANKS: RankSet = { division: null, sex: null, ageGroup: null };

/**
 * Standard competition ranking: tied entries share a rank and the following
 * rank skips, so times 10, 20, 20, 30 rank 1, 2, 2, 4.
 */
export function rankBy<T>(items: readonly T[], value: (item: T) => number, target: T): Rank | null {
  if (!items.includes(target)) return null;
  const own = value(target);
  let ahead = 0;
  for (const item of items) {
    if (value(item) < own) ahead += 1;
  }
  return { rank: ahead + 1, of: items.length };
}

/**
 * Ranks for one athlete against three nested groups. The tables are built
 * once per group per refresh and shared, so this is a lookup rather than a
 * scan of the whole division.
 */
function ranksAgainst(
  athlete: Athlete,
  checkpointId: string,
  pop: Populations,
  valueKey: string,
  value: (a: Athlete) => number | null,
): RankSet {
  if (value(athlete) === null) return EMPTY_RANKS;

  const division =
    pop.rankTable(`${valueKey}|${checkpointId}|div`, pop.atCheckpoint(checkpointId), value).get(
      athlete.bib,
    ) ?? null;

  const sex = athlete.sex
    ? (pop
        .rankTable(
          `${valueKey}|${checkpointId}|sex:${athlete.sex}`,
          pop.atCheckpointBySex(checkpointId, athlete.sex),
          value,
        )
        .get(athlete.bib) ?? null)
    : null;

  const ageGroup = athlete.ageGroup
    ? (pop
        .rankTable(
          `${valueKey}|${checkpointId}|age:${athlete.ageGroup.id}`,
          pop.atCheckpointByAgeGroup(checkpointId, athlete.ageGroup.id),
          value,
        )
        .get(athlete.bib) ?? null)
    : null;

  return { division, sex, ageGroup };
}

/** Ranks by elapsed time at one checkpoint, against everyone who reached it. */
export function ranksAtCheckpoint(
  athlete: Athlete,
  checkpointId: string,
  pop: Populations,
): RankSet {
  return ranksAgainst(athlete, checkpointId, pop, "elapsed", (a) => elapsedAt(a, checkpointId));
}

export interface DisciplineRankResult {
  readonly ranks: RankSet;
  /** True while the discipline is still in progress. */
  readonly provisional: boolean;
  /** Checkpoint the provisional rank was taken at, or the discipline end. */
  readonly atCheckpoint: string | null;
  /** Time the rank was taken on, in milliseconds. */
  readonly timeMs: number | null;
}

/**
 * Rank one discipline. A completed discipline is ranked on its full time
 * against everyone who completed it. A discipline in progress is ranked on
 * the time to the athlete's furthest checkpoint inside it, against everyone
 * measured at that same checkpoint, and marked provisional.
 */
export function disciplineRanks(
  athlete: Athlete,
  discipline: Discipline,
  pop: Populations,
  course: DivisionCourse,
): DisciplineRankResult {
  const from = disciplineStart(discipline);
  const to = disciplineEnd(discipline);

  const complete = splitBetween(athlete, from, to);
  if (complete !== null) {
    return {
      ranks: ranksAgainst(athlete, to, pop, `split:${from}`, (a) => splitBetween(a, from, to)),
      provisional: false,
      atCheckpoint: to,
      timeMs: complete,
    };
  }

  const latest = latestCheckpoint(athlete, course);
  if (latest === null) {
    return { ranks: EMPTY_RANKS, provisional: true, atCheckpoint: null, timeMs: null };
  }

  const startIndex = checkpointIndex(course, from);
  const latestIndex = checkpointIndex(course, latest);
  const endIndex = checkpointIndex(course, to);
  if (latestIndex <= startIndex || latestIndex >= endIndex) {
    return { ranks: EMPTY_RANKS, provisional: true, atCheckpoint: null, timeMs: null };
  }

  return {
    ranks: ranksAgainst(athlete, latest, pop, `split:${from}`, (a) => splitBetween(a, from, latest)),
    provisional: true,
    atCheckpoint: latest,
    timeMs: splitBetween(athlete, from, latest),
  };
}

export interface RankHistoryEntry {
  readonly checkpointId: string;
  readonly label: string;
  readonly elapsedMs: number;
  readonly ranks: RankSet;
}

/** Cumulative ranks at every checkpoint the athlete has passed, in course order. */
export function cumulativeRanks(
  athlete: Athlete,
  pop: Populations,
  course: DivisionCourse,
): RankHistoryEntry[] {
  const entries: RankHistoryEntry[] = [];
  for (const checkpoint of course.checkpoints) {
    if (checkpoint.id === "start") continue;
    const elapsed = elapsedAt(athlete, checkpoint.id);
    if (elapsed === null) continue;
    entries.push({
      checkpointId: checkpoint.id,
      label: checkpoint.label,
      elapsedMs: elapsed,
      ranks: ranksAtCheckpoint(athlete, checkpoint.id, pop),
    });
  }
  return entries;
}

/** Rank of one segment between consecutive checkpoints. */
export function splitRank(
  athlete: Athlete,
  from: string,
  to: string,
  pop: Populations,
): Rank | null {
  return (
    pop
      .rankTable(`segment:${from}->${to}`, pop.atCheckpoint(to), (a) => splitBetween(a, from, to))
      .get(athlete.bib) ?? null
  );
}
