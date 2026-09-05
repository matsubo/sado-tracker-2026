import type { Discipline, DivisionCourse } from "@/config/races";
import type { Athlete } from "@/lib/domain/types";

/** Checkpoints that bound each discipline. */
const DISCIPLINE_BOUNDS: Record<Discipline, { from: string; to: string }> = {
  swim: { from: "start", to: "swimF" },
  bike: { from: "bikeS", to: "runS" },
  run: { from: "runS", to: "finish" },
};

function timeAt(athlete: Athlete, checkpointId: string): number | null {
  if (checkpointId === "start") return athlete.startAt;
  return athlete.passes[checkpointId] ?? null;
}

/** Time from the wave start to a checkpoint, or null if not reached. */
export function elapsedAt(athlete: Athlete, checkpointId: string): number | null {
  const at = timeAt(athlete, checkpointId);
  return at === null ? null : at - athlete.startAt;
}

/** Time between two checkpoints, or null if either end is missing. */
export function splitBetween(athlete: Athlete, from: string, to: string): number | null {
  const start = timeAt(athlete, from);
  const end = timeAt(athlete, to);
  return start === null || end === null ? null : end - start;
}

/**
 * Completed time for one discipline. Transitions are excluded: the bike leg
 * runs from the bike start, not from the swim finish.
 */
export function disciplineTime(
  athlete: Athlete,
  discipline: Discipline,
  _course: DivisionCourse,
): number | null {
  const bounds = DISCIPLINE_BOUNDS[discipline];
  return splitBetween(athlete, bounds.from, bounds.to);
}

/** The checkpoint that opens a discipline, used for provisional splits. */
export function disciplineStart(discipline: Discipline): string {
  return DISCIPLINE_BOUNDS[discipline].from;
}

/** The checkpoint that closes a discipline. */
export function disciplineEnd(discipline: Discipline): string {
  return DISCIPLINE_BOUNDS[discipline].to;
}

/** Distance of one discipline on a given course, in kilometres. */
export function disciplineKm(discipline: Discipline, course: DivisionCourse): number {
  if (discipline === "swim") return course.swimKm;
  if (discipline === "bike") return course.bikeKm;
  return course.runKm;
}
