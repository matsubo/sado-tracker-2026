import { COURSE_SHARES, type Discipline } from "@/config/races";
import type { CheckpointDto } from "@/lib/api/contract";

/**
 * Geometry shared by every course strip: the map, the athlete page's
 * neighbour chart and the position bar. Each leg gets a FIXED share of the
 * axis rather than a share of the real distance, so a dot's position is only
 * comparable to others on the same leg, which is what a supporter reads it
 * for; see COURSE_SHARES.
 */

export interface Band {
  readonly x0: number;
  readonly x1: number;
  /** Length of the leg in kilometres, or 0 when the course has no such leg. */
  readonly km: number;
}

export type Axis = Readonly<Record<Discipline, Band>>;

export interface Tick {
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly leg: Discipline;
}

export type Anchor = "start" | "middle" | "end";

export interface AxisLabel {
  readonly key: string;
  readonly text: string;
  readonly x: number;
  readonly anchor: Anchor;
}

export const LABEL_FONT = 8.5;
/** Clear space required between two axis labels, in viewBox units. */
export const LABEL_GAP = 4;
/** Full-width glyphs take about one em, latin about half. */
const CJK = /[　-鿿＀-￯]/;
/** Candidate spacings for a kilometre scale, coarsest that fits chosen. */
const KM_STEPS = [5, 10, 20, 25, 50];

/** Transition points sit on the bike leg; everything else maps to its own leg. */
export const toLeg = (discipline: string): Discipline =>
  discipline === "swim" || discipline === "run" ? discipline : "bike";

/** Three fixed-width bands, each scaled to the length of its own leg. */
export function buildAxis(checkpoints: readonly CheckpointDto[], x0: number, x1: number): Axis {
  const width = x1 - x0;
  const km = (leg: Discipline): number =>
    checkpoints.reduce((max, c) => (toLeg(c.discipline) === leg ? Math.max(max, c.km) : max), 0);
  const swim = x0 + width * COURSE_SHARES.swim;
  const bike = swim + width * COURSE_SHARES.bike;
  return {
    swim: { x0, x1: swim, km: km("swim") },
    bike: { x0: swim, x1: bike, km: km("bike") },
    run: { x0: bike, x1, km: km("run") },
  };
}

/** Kilometres within a leg to a course-wide x coordinate. */
export function scaleKm(axis: Axis, leg: Discipline, km: number): number {
  const band = axis[leg];
  const ratio = band.km > 0 ? Math.min(Math.max(km / band.km, 0), 1) : 0;
  return band.x0 + (band.x1 - band.x0) * ratio;
}

/** Every checkpoint as an x position, with points on the same pixel merged. */
export function buildTicks(checkpoints: readonly CheckpointDto[], axis: Axis): Tick[] {
  const raw: Tick[] = [
    { id: "start", label: "START", x: axis.swim.x0, leg: "swim" },
    ...checkpoints.map((c) => {
      const leg = toLeg(c.discipline);
      return { id: c.id, label: c.label, x: scaleKm(axis, leg, c.km), leg };
    }),
  ];
  return raw.filter((t, i) => raw.findIndex((o) => Math.round(o.x) === Math.round(t.x)) === i);
}

/** Rough advance width of a label, in viewBox units. */
export function labelWidth(text: string): number {
  let em = 0;
  for (const char of text) em += CJK.test(char) ? 1 : 0.55;
  return em * LABEL_FONT;
}

/** Left and right edges of a label drawn at its anchor, in viewBox units. */
export function edgesOf(label: AxisLabel): { left: number; right: number } {
  const width = labelWidth(label.text);
  if (label.anchor === "start") return { left: label.x, right: label.x + width };
  if (label.anchor === "end") return { left: label.x - width, right: label.x };
  return { left: label.x - width / 2, right: label.x + width / 2 };
}

/**
 * Keeps labels left to right, dropping any that would touch the one before.
 * Two timing points can share an x, the swim finish and the bike start are
 * the same place, so a gap test on positions alone is not enough. With
 * `keepLast` the final label wins a collision instead, because the end of
 * a course matters more than the point just before it.
 */
export function fitLabels(
  labels: readonly AxisLabel[],
  options: { readonly keepLast?: boolean } = {},
): AxisLabel[] {
  const kept: AxisLabel[] = [];
  let lastRight = Number.NEGATIVE_INFINITY;
  labels.forEach((label, index) => {
    const { left, right } = edgesOf(label);
    if (left >= lastRight + LABEL_GAP) {
      kept.push(label);
      lastRight = right;
    } else if (options.keepLast && index === labels.length - 1) {
      kept.splice(-1, 1, label);
      lastRight = right;
    }
  });
  return kept;
}

/** Round kilometre marks along a band, spaced at least `minGap` apart. */
export function kmTicks(band: Band, minGap: number): { km: number; x: number }[] {
  if (band.km <= 0) return [];
  const width = band.x1 - band.x0;
  const step = KM_STEPS.find((value) => (width * value) / band.km >= minGap);
  if (step === undefined) return [];
  const marks: { km: number; x: number }[] = [];
  for (let km = step; km < band.km; km += step) {
    marks.push({ km, x: band.x0 + (width * km) / band.km });
  }
  return marks;
}
