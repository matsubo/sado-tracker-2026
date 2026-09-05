"use client";

import type { Discipline } from "@/config/races";
import { projectKm } from "@/hooks/useLivePosition";
import type { PositionDto } from "@/lib/api/contract";
import { cn } from "@/lib/utils/cn";

/**
 * Course geometry shared by the position bar and the course strip.
 *
 * The three legs take a fixed share of the width rather than a share
 * proportional to their distance: the swim is 2 % of the course by distance
 * but a fifth of the day, so a distance-true axis would collapse it to a
 * hairline and make the bar useless for the hours an athlete spends there.
 */
export const COURSE_SEGMENTS = [
  { discipline: "swim", label: "スイム", width: 0.22, tone: "swim" },
  { discipline: "bike", label: "バイク", width: 0.48, tone: "bike" },
  { discipline: "run", label: "ラン", width: 0.3, tone: "run" },
] as const satisfies readonly {
  discipline: Discipline;
  label: string;
  width: number;
  tone: string;
}[];

/** Full distance of each leg, in kilometres. */
export type DisciplineKm = Readonly<Record<Discipline, number>>;

/**
 * The furthest the browser will extrapolate past the server's estimate. The
 * race data is polled every 15 s, so two minutes covers a slow poll with room
 * to spare.
 */

/**
 * Where an athlete is now, on the race clock. This delegates to the one
 * shared projection so the friend card, the athlete page and the field map
 * never disagree about the same athlete, and so a server snapshot that stops
 * refreshing degrades identically on all three.
 */
export function liveKm(position: PositionDto, nowMs: number): number {
  return projectKm(position, nowMs);
}

/** Clamps a value into the closed unit interval. */
const unit = (value: number): number => Math.min(Math.max(value, 0), 1);

/** Position along the whole course, as a fraction between 0 and 1. */
export function courseFraction(discipline: Discipline, km: number, totals: DisciplineKm): number {
  let base = 0;
  for (const segment of COURSE_SEGMENTS) {
    if (segment.discipline === discipline) {
      const total = totals[segment.discipline];
      return base + unit(total > 0 ? km / total : 0) * segment.width;
    }
    base += segment.width;
  }
  return base;
}

/* Axis label layout, shared with the course strip. --------------------- */

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
const CJK = /[\u3000-\u9fff\uff00-\uffef]/;

/** Left and right edges of a label drawn at its anchor, in viewBox units. */
export function edgesOf(label: AxisLabel): { left: number; right: number } {
  let em = 0;
  for (const char of label.text) em += CJK.test(char) ? 1 : 0.55;
  const width = em * LABEL_FONT;
  if (label.anchor === "start") return { left: label.x, right: label.x + width };
  if (label.anchor === "end") return { left: label.x - width, right: label.x };
  return { left: label.x - width / 2, right: label.x + width / 2 };
}

/**
 * Keeps labels left to right, dropping any that would touch the one before.
 * Two timing points can share an x — the swim finish and the bike start are
 * the same place — so a gap test on positions alone is not enough.
 */
export function fitLabels(labels: readonly AxisLabel[]): AxisLabel[] {
  const kept: AxisLabel[] = [];
  let lastRight = Number.NEGATIVE_INFINITY;
  for (const label of labels) {
    const { left, right } = edgesOf(label);
    if (left < lastRight + LABEL_GAP) continue;
    kept.push(label);
    lastRight = right;
  }
  return kept;
}

/**
 * Where a leg's timing points sit along its bar, as fractions. The two ends
 * are left out: they are the leg boundaries, already drawn as the gap between
 * segments, and a tick there would read as a stray mark.
 */
function ticksFor(
  segment: Discipline,
  checkpoints: readonly BarCheckpoint[] | undefined,
  legKm: Partial<DisciplineKm> | undefined,
  current: Discipline,
  currentTotalKm: number,
): number[] {
  if (!checkpoints) return [];
  const total = legKm?.[segment] ?? (segment === current ? currentTotalKm : 0);
  if (!total || total <= 0) return [];

  const seen = new Set<number>();
  for (const checkpoint of checkpoints) {
    if (checkpoint.discipline !== segment) continue;
    const at = checkpoint.km / total;
    if (at <= 0.02 || at >= 0.98) continue;
    seen.add(Math.round(at * 1000) / 1000);
  }
  return [...seen].sort((a, b) => a - b);
}

/** How full each leg's bar is, given the leg the athlete is currently on. */
function fillOf(segment: Discipline, current: Discipline, progress: number): number {
  const order: readonly Discipline[] = ["swim", "bike", "run"];
  const at = order.indexOf(segment);
  const now = order.indexOf(current);
  if (at < now) return 1;
  if (at > now) return 0;
  return unit(progress);
}

const TONE_FILL: Record<string, string> = {
  swim: "bg-[color:var(--swim)]",
  bike: "bg-[color:var(--bike)]",
  run: "bg-[color:var(--run)]",
};

const SEGMENT_BASIS: Record<Discipline, string> = {
  swim: "basis-[22%] grow-0",
  bike: "basis-[48%] grow-0",
  run: "basis-[30%] grow-0",
};

/** A timing point, placed within its own leg. */
export interface BarCheckpoint {
  readonly discipline: Discipline;
  /** Kilometres into that leg. */
  readonly km: number;
}

/**
 * Distance of each leg, read off the checkpoints that close them: the swim
 * finish, the run start (which is the end of the bike) and the finish. Needed
 * so the ticks can be placed on legs the athlete has not reached yet.
 */
export function legDistances(
  checkpoints: readonly { id: string; km: number }[] | undefined,
): Partial<DisciplineKm> {
  if (!checkpoints) return {};
  const kmOf = (id: string) => checkpoints.find((c) => c.id === id)?.km;
  return {
    ...(kmOf("swimF") === undefined ? {} : { swim: kmOf("swimF") }),
    ...(kmOf("runS") === undefined ? {} : { bike: kmOf("runS") }),
    ...(kmOf("finish") === undefined ? {} : { run: kmOf("finish") }),
  };
}

/** Timing points of one division, in the shape the bar wants. */
export function barCheckpoints(
  checkpoints: readonly { discipline: string; km: number }[] | undefined,
): BarCheckpoint[] {
  if (!checkpoints) return [];
  const legs: readonly Discipline[] = ["swim", "bike", "run"];
  return checkpoints
    .filter((c): c is { discipline: Discipline; km: number } =>
      legs.includes(c.discipline as Discipline),
    )
    .map((c) => ({ discipline: c.discipline, km: c.km }));
}

interface PositionBarProps {
  readonly discipline: Discipline;
  /** Estimated kilometres completed within `discipline`. */
  readonly estKm: number;
  readonly totalKm: number;
  /** Timing points to mark, so the bar shows where the next reading comes from. */
  readonly checkpoints?: readonly BarCheckpoint[];
  /** Full distance of each leg, needed to place the ticks. */
  readonly legKm?: Partial<DisciplineKm>;
  /** True once the estimate is parked on a timing point rather than projected. */
  readonly waiting: boolean;
  /** Fills every leg and pins the marker to the finish. */
  readonly finished: boolean;
  readonly nextLabel: string | null;
  readonly className?: string;
}

/**
 * Where the athlete is on the course, as three proportional segments with a
 * marker at the estimated position. A dashed marker is a projection, a solid
 * one sits on a timing point.
 */
export function PositionBar({
  discipline,
  estKm,
  totalKm,
  checkpoints,
  legKm,
  waiting,
  finished,
  nextLabel,
  className,
}: PositionBarProps): React.JSX.Element {
  const progress = finished ? 1 : totalKm > 0 ? unit(estKm / totalKm) : 0;
  const current = COURSE_SEGMENTS.find((segment) => segment.discipline === discipline);
  const legLabel = current?.label ?? "";

  return (
    <div className={className}>
      <div className="flex gap-[3px]">
        {COURSE_SEGMENTS.map((segment) => {
          const fill = finished ? 1 : fillOf(segment.discipline, discipline, progress);
          const marked = finished
            ? segment.discipline === "run"
            : segment.discipline === discipline;
          return (
            <div
              key={segment.discipline}
              className={cn(
                "relative h-2.5 rounded-full bg-muted",
                SEGMENT_BASIS[segment.discipline],
              )}
            >
              <div
                className={cn("absolute inset-y-0 left-0 rounded-full", TONE_FILL[segment.tone])}
                style={{ width: `${fill * 100}%` }}
              />
              {ticksFor(segment.discipline, checkpoints, legKm, discipline, totalKm).map((at) => (
                <span
                  key={at}
                  aria-hidden="true"
                  className="absolute inset-y-[1px] w-px bg-foreground/25"
                  style={{ left: `${at * 100}%` }}
                />
              ))}
              {marked ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "-top-1 -translate-x-1/2 absolute size-[18px] rounded-full border-[3px] border-foreground bg-card",
                    !finished && !waiting && "border-dashed",
                  )}
                  style={{ left: `${fill * 100}%` }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-[11px] text-muted-foreground tnum">
        <span>
          {finished ? (
            <>フィニッシュ済み</>
          ) : (
            <>
              {legLabel} 約{" "}
              <b className="font-semibold text-foreground">
                {estKm.toFixed(1)} / {totalKm} km
              </b>
              （推定）
            </>
          )}
        </span>
        {!finished && nextLabel ? <span>次: {nextLabel}</span> : null}
      </div>
    </div>
  );
}
