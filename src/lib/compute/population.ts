import type { Division, DivisionCourse } from "@/config/races";
import type { Athlete } from "@/lib/domain/types";
import { athleteStatus, isScored } from "./status";

export interface Populations {
  readonly division: Division;
  /** Scored athletes of this division, in bib order. */
  readonly all: readonly Athlete[];
  /** Athletes who have reached a checkpoint. */
  atCheckpoint(checkpointId: string): readonly Athlete[];
  /** Athletes who have reached a checkpoint and share a sex. */
  atCheckpointBySex(checkpointId: string, sex: "M" | "F"): readonly Athlete[];
  /** Athletes who have reached a checkpoint and share an age group. */
  atCheckpointByAgeGroup(checkpointId: string, ageGroupId: string): readonly Athlete[];
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
 * against the exact set of athletes who have been measured there.
 */
export function buildPopulations(
  athletes: readonly Athlete[],
  division: Division,
  course: DivisionCourse,
  nowMs: number,
): Populations {
  const scored = athletes.filter(
    (a) => a.division === division && isScored(athleteStatus(a, course, nowMs)),
  );

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

  return {
    division,
    all: scored,
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
  };
}
