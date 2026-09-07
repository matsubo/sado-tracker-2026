import type { Discipline } from "./types";

/** Swim, bike, run: the order they are raced in. */
export const DISCIPLINES = ["swim", "bike", "run"] as const satisfies readonly Discipline[];

export const DISCIPLINE_LABELS: Readonly<Record<Discipline, string>> = {
  swim: "スイム",
  bike: "バイク",
  run: "ラン",
};

/**
 * Each leg's share of a course drawn as one axis. The shares are fixed rather
 * than proportional to distance: the swim is two percent of the course and a
 * fifth of the day, so a distance-true axis would collapse the hours an
 * athlete spends in the water to a hairline. Used by every course strip, the
 * position bar and the shared-link card, so they all agree.
 */
export const COURSE_SHARES: Readonly<Record<Discipline, number>> = {
  swim: 0.22,
  bike: 0.48,
  run: 0.3,
};

export function isDiscipline(value: string): value is Discipline {
  return (DISCIPLINES as readonly string[]).includes(value);
}
