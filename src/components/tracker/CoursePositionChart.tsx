"use client";

import type { Discipline } from "@/config/races";
import { projectKm } from "@/hooks/useLivePosition";
import type { MapEntryDto } from "@/lib/api/contract";
import { COURSE_SEGMENTS, courseFraction, type DisciplineKm } from "./PositionBar";

/** A timing point as the race endpoint publishes it. */
export interface CourseCheckpoint {
  readonly id: string;
  readonly label: string;
  readonly km: number;
  readonly discipline: string;
}

const VIEW_W = 420;
const PLOT_LEFT = 100;
const PLOT_RIGHT = 330;
const PLOT_W = PLOT_RIGHT - PLOT_LEFT;
const ROW_TOP = 46;
const ROW_H = 18;
const BAND_Y = 20;
const TICK_TOP = 30;
/** Keeps the rightmost distance label inside the viewBox. */
const FLIP_X = PLOT_LEFT + PLOT_W * 0.78;

const LEG_LABEL: Record<Discipline, string> = { swim: "スイム", bike: "バイク", run: "ラン" };
const LEG_COLOR: Record<Discipline, string> = {
  swim: "var(--swim)",
  bike: "var(--bike)",
  run: "var(--run)",
};
const BAND_COLOR: Record<Discipline, string> = {
  swim: "var(--swim-bg)",
  bike: "var(--bike-bg)",
  run: "var(--run-bg)",
};

const isDiscipline = (value: string): value is Discipline =>
  value === "swim" || value === "bike" || value === "run";

/** X coordinate of a course fraction. */
const plotX = (fraction: number): number => PLOT_LEFT + fraction * PLOT_W;

/** Drops labels that would collide with the previous one. */
function spaced<T extends { x: number }>(items: readonly T[], minGap: number): T[] {
  const kept: T[] = [];
  let last = Number.NEGATIVE_INFINITY;
  for (const item of items) {
    if (item.x - last >= minGap) {
      kept.push(item);
      last = item.x;
    }
  }
  return kept;
}

/** Estimated kilometres for one athlete at `nowMs`, within their current leg. */
function estimateKm(entry: MapEntryDto, nowMs: number): number {
  if (entry.status === "finished") return entry.position.totalKm;
  if (entry.status === "racing") return projectKm(entry.position, nowMs);
  if (entry.status === "dnf") return entry.position.estKm;
  return 0;
}

/** The text shown to the right of each dot. */
function distanceText(entry: MapEntryDto, km: number): string {
  if (entry.status === "finished") return "フィニッシュ";
  if (entry.status === "not_started") return "スタート前";
  if (entry.status === "dns_suspected") return "未計測";
  if (entry.status === "dnf") return "DNF";
  if (entry.position.waiting && entry.position.lastCheckpointLabel !== null) {
    return `${entry.position.lastCheckpointLabel} 計測待ち`;
  }
  return `${LEG_LABEL[entry.position.discipline]} ${km.toFixed(1)}km`;
}

interface CoursePositionChartProps {
  readonly entries: readonly MapEntryDto[];
  readonly checkpoints: readonly CourseCheckpoint[];
  readonly totals: DisciplineKm;
  readonly nowMs: number;
}

/**
 * The course as one horizontal axis with an athlete per row, so a supporter
 * can see at a glance who is ahead of their friend and by how far.
 */
export function CoursePositionChart({
  entries,
  checkpoints,
  totals,
  nowMs,
}: CoursePositionChartProps): React.JSX.Element {
  const ticks = checkpoints
    .filter((cp) => isDiscipline(cp.discipline))
    .map((cp) => ({
      ...cp,
      x: plotX(courseFraction(cp.discipline as Discipline, cp.km, totals)),
      leg: cp.discipline as Discipline,
    }));
  const rows = entries.map((entry, index) => {
    const km = estimateKm(entry, nowMs);
    return {
      entry,
      km,
      y: ROW_TOP + index * ROW_H,
      x: plotX(courseFraction(entry.position.discipline, km, totals)),
    };
  });

  const lastY = rows.length > 0 ? ROW_TOP + (rows.length - 1) * ROW_H : ROW_TOP;
  const tickBottom = lastY + 9;
  const viewH = lastY + 30;
  const topLabels = spaced(
    [{ id: "start", label: "START", x: PLOT_LEFT }, ...ticks.filter((t) => t.leg !== "run")],
    26,
  );
  const bottomLabels = spaced(
    ticks.filter((t) => t.leg === "run"),
    24,
  );

  return (
    <div className="rounded-lg border border-border bg-card px-2 pt-2.5 pb-1.5">
      <svg
        viewBox={`0 0 ${VIEW_W} ${viewH}`}
        role="img"
        aria-label="コース上のおおよその位置"
        className="block h-auto w-full"
      >
        <title>コース上のおおよその位置</title>
        {COURSE_SEGMENTS.map((segment, index) => {
          const start = COURSE_SEGMENTS.slice(0, index).reduce((sum, s) => sum + s.width, 0);
          return (
            <rect
              key={segment.discipline}
              x={plotX(start)}
              y={BAND_Y}
              width={segment.width * PLOT_W - 2}
              height={6}
              rx={3}
              fill={BAND_COLOR[segment.discipline]}
            />
          );
        })}
        <g stroke="var(--border)" strokeWidth={1} strokeDasharray="2 3">
          {ticks.map((tick) => (
            <line key={tick.id} x1={tick.x} y1={TICK_TOP} x2={tick.x} y2={tickBottom} />
          ))}
        </g>
        <g fill="var(--muted-foreground)" fontSize={8.5}>
          {topLabels.map((label) => (
            <text
              key={label.id}
              x={label.x}
              y={14}
              textAnchor={
                label.x <= PLOT_LEFT + 8 ? "start" : label.x >= PLOT_RIGHT - 8 ? "end" : "middle"
              }
            >
              {label.label}
            </text>
          ))}
          {bottomLabels.map((label) => (
            <text
              key={label.id}
              x={label.x}
              y={lastY + 24}
              textAnchor={label.x >= PLOT_RIGHT - 8 ? "end" : "middle"}
            >
              {label.label}
            </text>
          ))}
        </g>
        {rows.map((row) =>
          row.entry.isSelf === true ? (
            <rect
              key={`hl-${row.entry.bib}`}
              x={8}
              y={row.y - 8}
              width={VIEW_W - 16}
              height={16}
              rx={3}
              fill="var(--highlight)"
            />
          ) : null,
        )}
        {rows.map((row) => {
          const self = row.entry.isSelf === true;
          const solid = self || row.entry.position.waiting || row.entry.status === "finished";
          const color = self ? "var(--primary)" : LEG_COLOR[row.entry.position.discipline];
          const flip = row.x > FLIP_X;
          return (
            <g key={row.entry.bib}>
              <text
                x={PLOT_LEFT - 8}
                y={row.y + 3}
                textAnchor="end"
                fontSize={10}
                fill={self ? "var(--foreground)" : "var(--muted-foreground)"}
                fontWeight={self ? 700 : 400}
              >
                {row.entry.name}
              </text>
              <circle
                cx={row.x}
                cy={row.y}
                r={self ? 6 : 4.5}
                fill={solid ? color : "var(--card)"}
                stroke={color}
                strokeWidth={2}
                strokeDasharray={solid ? undefined : "2 2"}
              />
              <text
                x={flip ? row.x - 10 : row.x + 10}
                y={row.y + 3}
                textAnchor={flip ? "end" : "start"}
                fontSize={8.5}
                fill={self ? "var(--foreground)" : "var(--muted-foreground)"}
                fontWeight={self ? 700 : 400}
              >
                {distanceText(row.entry, row.km)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-center gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="size-2 rounded-full bg-foreground" />
          計測済み
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            aria-hidden="true"
            className="size-2 rounded-full border border-muted-foreground border-dashed"
          />
          推定
        </span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
          この選手
        </span>
      </div>
    </div>
  );
}
