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
const MAX_PROJECTION_MS = 120_000;

/**
 * Move an athlete forward between server updates.
 *
 * The projection starts from the estimate the server already computed and is
 * capped at two minutes of travel, rather than running from the last timing
 * point on the browser's clock. The two clocks are not the same clock: a
 * replay feed carries last year's timestamps, so an uncapped projection from
 * `lastAt` advances every athlete by months and parks the whole field on the
 * next timing point.
 */
export function liveKm(position: PositionDto, nowMs: number): number {
  const elapsed = Math.min(Math.max(nowMs - position.lastAt, 0), MAX_PROJECTION_MS);
  return projectKm({ ...position, lastKm: position.estKm, lastAt: 0 }, elapsed);
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

interface PositionBarProps {
  readonly discipline: Discipline;
  /** Estimated kilometres completed within `discipline`. */
  readonly estKm: number;
  readonly totalKm: number;
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
