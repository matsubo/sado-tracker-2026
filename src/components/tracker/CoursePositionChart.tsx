"use client";

import type { Discipline } from "@/config/races";
import type { MapEntryDto } from "@/lib/api/contract";
import {
  type Anchor,
  type AxisLabel,
  COURSE_SEGMENTS,
  courseFraction,
  type DisciplineKm,
  edgesOf,
  fitLabels,
  LABEL_FONT,
  LABEL_GAP,
  liveKm,
} from "./PositionBar";

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
/** Kilometre step of the scale drawn under the run band. */
const RUN_STEP_KM = 10;

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

/** A dot is solid once it sits on a timing point, dashed while projected. */
const LEGEND = [
  { text: "計測済み", swatch: "bg-foreground" },
  { text: "推定", swatch: "border border-muted-foreground border-dashed" },
  { text: "この選手", swatch: "bg-primary" },
] as const;

const isDiscipline = (value: string): value is Discipline =>
  value === "swim" || value === "bike" || value === "run";

/** X coordinate of a course fraction. */
const plotX = (fraction: number): number => PLOT_LEFT + fraction * PLOT_W;

/** Anchors the outermost labels inwards so they stay inside the viewBox. */
const anchorFor = (x: number): Anchor =>
  x <= PLOT_LEFT + 4 ? "start" : x >= PLOT_RIGHT - 4 ? "end" : "middle";

/** Drops the parenthetical qualifier, so "ランS（本部）" reads as "ランS". */
const shortLabel = (label: string): string => label.replace(/[（(][^）)]*[）)]/g, "");

/** A leg boundary carries a label; the km marks inside the run leg do not. */
const isLegBoundary = (checkpoint: { id: string; discipline: string }): boolean =>
  checkpoint.discipline !== "run" || checkpoint.id === "finish";

/** Estimated kilometres for one athlete at `nowMs`, within their current leg. */
function estimateKm(entry: MapEntryDto, nowMs: number): number {
  if (entry.status === "finished") return entry.position.totalKm;
  if (entry.status === "racing") return liveKm(entry.position, nowMs);
  if (entry.status === "dnf") return entry.position.estKm;
  return 0;
}

/** The timing point an athlete is next expected to reach. */
function nextLabelOf(entry: MapEntryDto, checkpoints: readonly CourseCheckpoint[]): string | null {
  const passed = checkpoints.findIndex((cp) => cp.label === entry.position.lastCheckpointLabel);
  return checkpoints[passed + 1]?.label ?? null;
}

/** The text shown to the right of each dot. */
function distanceText(
  entry: MapEntryDto,
  km: number,
  checkpoints: readonly CourseCheckpoint[],
): string {
  if (entry.status === "finished") return "フィニッシュ";
  if (entry.status === "not_started") return "スタート前";
  if (entry.status === "dns_suspected") return "未計測";
  if (entry.status === "dnf") return "DNF";
  if (entry.position.waiting) {
    const next = nextLabelOf(entry, checkpoints);
    return next === null ? "計測待ち" : `${next} 計測待ち`;
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
 *
 * The x axis is NOT distance-true. Each leg gets a fixed share of the width —
 * swim 22 %, bike 48 %, run 30 %, the same split PositionBar uses — and an
 * athlete's kilometres are mapped within their own leg's band. Drawing the
 * legs to real distance would give the 4 km swim 2 % of the axis and pile
 * every swimmer onto one edge, even though the swim is a fifth of the day.
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

  // Above the bands, only the leg boundaries are named: START, the swim
  // finish, the bike start, 住吉 and the run start. The eleven run kilometre
  // points stay as bare tick lines and get the sparse scale below instead,
  // which is the only way six labels fit across a phone-width axis.
  const topLabels = fitLabels([
    { key: "start", text: "START", x: PLOT_LEFT, anchor: anchorFor(PLOT_LEFT) },
    ...ticks.filter(isLegBoundary).map((tick) => ({
      key: tick.id,
      text: shortLabel(tick.label),
      x: tick.x,
      anchor: anchorFor(tick.x),
    })),
  ]);

  // Under the run band, a kilometre scale every 10 km and then the finish.
  // FIN is reserved first and the last kilometre mark yields to it, because
  // the end of the race is worth more than the number just before it.
  const runKm = totals.run;
  const finish: AxisLabel = { key: "run-fin", text: "FIN", x: PLOT_RIGHT, anchor: "end" };
  const finishLeft = edgesOf(finish).left;
  const runMarks: AxisLabel[] = [];
  for (let km = 0; km < runKm; km += RUN_STEP_KM) {
    const x = plotX(courseFraction("run", km, totals));
    const mark: AxisLabel = { key: `run-${km}`, text: String(km), x, anchor: anchorFor(x) };
    if (edgesOf(mark).right + LABEL_GAP <= finishLeft) runMarks.push(mark);
  }
  const bottomLabels = runKm > 0 ? [...fitLabels(runMarks), finish] : [];

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
        <g fill="var(--muted-foreground)" fontSize={LABEL_FONT}>
          {topLabels.map((label) => (
            <text key={label.key} x={label.x} y={14} textAnchor={label.anchor}>
              {label.text}
            </text>
          ))}
          {bottomLabels.map((label) => (
            <text key={label.key} x={label.x} y={lastY + 24} textAnchor={label.anchor}>
              {label.text}
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
              {/* A name is the obvious thing to tap, so it opens that athlete. */}
              <a
                href={`/athletes/${row.entry.bib}`}
                aria-label={`${row.entry.name} の詳細`}
                className="cursor-pointer outline-none focus-visible:underline"
              >
                <text
                  x={PLOT_LEFT - 8}
                  y={row.y + 3}
                  textAnchor="end"
                  fontSize={10}
                  fill={self ? "var(--foreground)" : "var(--muted-foreground)"}
                  fontWeight={self ? 700 : 400}
                  className="hover:underline"
                >
                  {row.entry.name}
                </text>
              </a>
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
                {distanceText(row.entry, row.km, checkpoints)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-center gap-3 text-[11px] text-muted-foreground">
        {LEGEND.map((item) => (
          <span key={item.text} className="inline-flex items-center gap-1">
            <span aria-hidden="true" className={`size-2 rounded-full ${item.swatch}`} />
            {item.text}
          </span>
        ))}
      </div>
    </div>
  );
}
