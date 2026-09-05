"use client";

import Link from "next/link";
import { type KeyboardEvent, useMemo, useRef, useState } from "react";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { type AgeGroup, compareAgeGroups, type Division, normalizeAgeGroup } from "@/config/races";
import { useBookmarks } from "@/hooks/useBookmarks";
import { projectKm, useLiveClock } from "@/hooks/useLivePosition";
import { useLiveResource, useRaceState } from "@/hooks/useSnapshot";
import type { MapEntryDto, RaceStateDto } from "@/lib/api/contract";
import { cn } from "@/lib/utils/cn";

type Leg = "swim" | "bike" | "run";
type View = "division" | "age" | "friends";
type Checkpoint = RaceStateDto["divisions"][number]["checkpoints"][number];
type Band = { readonly x0: number; readonly x1: number; readonly km: number };
type Axis = Readonly<Record<Leg, Band>>;
type Tick = { readonly id: string; readonly label: string; readonly x: number; readonly leg: Leg };
type Label = Tick & { readonly y: number };

interface Placed {
  readonly entry: MapEntryDto;
  readonly x: number;
  readonly y: number;
  readonly km: number;
  readonly leg: Leg;
  /** Measured at a timing point, as opposed to projected forward from one. */
  readonly filled: boolean;
}

interface MapPayload {
  readonly division: Division;
  readonly count: number;
  readonly entries: readonly MapEntryDto[];
}

/** Each leg gets a fixed share of the axis, its own colour and its own label. */
const LEGS = ["swim", "bike", "run"] as const;
const LEG: Readonly<Record<Leg, { share: number; color: string; bg: string; label: string }>> = {
  swim: { share: 0.22, color: "var(--swim)", bg: "var(--swim-bg)", label: "スイム" },
  bike: { share: 0.48, color: "var(--bike)", bg: "var(--bike-bg)", label: "バイク" },
  run: { share: 0.3, color: "var(--run)", bg: "var(--run-bg)", label: "ラン" },
};

const DIVISION_IDS = ["A", "B", "RA", "RB"] as const;
const DIVISION_TABS = DIVISION_IDS.map((value) => ({ value, label: value }));
const VIEW_TABS = [
  { value: "division", label: "部門総合" },
  { value: "age", label: "エイジ別" },
  { value: "friends", label: "友達だけ" },
] as const;
const LEGEND = [
  { label: "スイム中", size: "size-1.5", color: LEG.swim.color },
  { label: "バイク中", size: "size-1.5", color: LEG.bike.color },
  { label: "ラン中", size: "size-1.5", color: LEG.run.color },
  { label: "友達", size: "size-2 bg-brand-cyan-400", color: undefined },
];

const VIEW_W = 360;
const DENSE = { x0: 40, x1: 356, y0: 26, y1: 236, height: 250, dot: 1.6 };
const NAMED = { x0: 84, x1: 352, top: 24, rowH: 16, dot: 4 };
const FRIEND_DOT = 5;
const LABEL_GAP = 26;
const ALL_AGE_GROUPS = "all";
const Y_TICKS = [1, 250, 500, 750];

/** Transition points sit on the bike leg; everything else maps to its own leg. */
const toLeg = (discipline: string): Leg =>
  discipline === "swim" || discipline === "run" ? discipline : "bike";

/** Three fixed-width bands, each scaled to the length of its own leg. */
function buildAxis(checkpoints: readonly Checkpoint[], x0: number, x1: number): Axis {
  const width = x1 - x0;
  const km = (leg: Leg): number =>
    checkpoints.reduce((max, c) => (toLeg(c.discipline) === leg ? Math.max(max, c.km) : max), 0);
  const swim = x0 + width * LEG.swim.share;
  const bike = swim + width * LEG.bike.share;
  return {
    swim: { x0, x1: swim, km: km("swim") },
    bike: { x0: swim, x1: bike, km: km("bike") },
    run: { x0: bike, x1, km: km("run") },
  };
}

/** Kilometres within a leg to a course-wide x coordinate. */
function scaleKm(axis: Axis, leg: Leg, km: number): number {
  const band = axis[leg];
  const ratio = band.km > 0 ? Math.min(Math.max(km / band.km, 0), 1) : 0;
  return band.x0 + (band.x1 - band.x0) * ratio;
}

/** Rows run top to bottom: the leader first, then one row per athlete. */
const rowY = (index: number, count: number, named: boolean): number =>
  named
    ? NAMED.top + 10 + index * NAMED.rowH
    : DENSE.y0 + ((DENSE.y1 - DENSE.y0) * index) / Math.max(1, count - 1);

const shortLabel = (label: string): string =>
  label === "FINISH" ? "FIN" : label.replace(/（.*）$/, "").replace(/^ラン/, "");

/** Checkpoints as x positions, with points that land on the same pixel merged. */
function buildTicks(checkpoints: readonly Checkpoint[], axis: Axis): Tick[] {
  const raw: Tick[] = [
    { id: "start", label: "START", x: axis.swim.x0, leg: "swim" },
    ...checkpoints.map((c) => {
      const leg = toLeg(c.discipline);
      return { id: c.id, label: shortLabel(c.label), x: scaleKm(axis, leg, c.km), leg };
    }),
  ];
  return raw.filter((t, i) => raw.findIndex((o) => Math.round(o.x) === Math.round(t.x)) === i);
}

/** Drop labels that would collide, always keeping the outermost one. */
function thin(ticks: readonly Tick[], y: number): Label[] {
  const kept: Label[] = [];
  for (const [index, tick] of ticks.entries()) {
    const last = kept.at(-1);
    if (last === undefined || tick.x - last.x >= LABEL_GAP) kept.push({ ...tick, y });
    else if (index === ticks.length - 1) kept.splice(-1, 1, { ...tick, y });
  }
  return kept;
}

const anchorAt = (x: number, x0: number, x1: number): "start" | "middle" | "end" =>
  x <= x0 + 4 ? "start" : x >= x1 - 4 ? "end" : "middle";

const isView = (value: string): value is View => VIEW_TABS.some((tab) => tab.value === value);
const isDivision = (value: string): value is Division => DIVISION_IDS.some((id) => id === value);

/**
 * Every racing athlete as one dot: how far along the course on the x axis,
 * field order on the y axis with the leader at the top. Dots advance between
 * server updates because the estimate is recomputed in the browser, and a dot
 * is hollow while its position is projected rather than measured.
 */
export function FieldMap({ initialDivision }: { readonly initialDivision: Division }) {
  const [division, setDivision] = useState<Division>(initialDivision);
  const [view, setView] = useState<View>("division");
  const [ageGroup, setAgeGroup] = useState(ALL_AGE_GROUPS);
  const [selected, setSelected] = useState<string | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const dots = useRef(new Map<string, SVGGElement>());

  const { race, fetchedAt } = useRaceState();
  const { bibs, ready } = useBookmarks();
  const now = useLiveClock();

  const friends = bibs.map(encodeURIComponent).join(",");
  const url = ready ? `/api/map?div=${division}${friends ? `&bibs=${friends}` : ""}` : null;
  const { data, error, loading } = useLiveResource<MapPayload>(url, fetchedAt);

  const checkpoints: readonly Checkpoint[] =
    race?.divisions.find((entry) => entry.id === division)?.checkpoints ?? [];

  // One unfiltered fetch feeds all three views, so the age list is complete.
  const ageOptions = useMemo(() => {
    const ids = new Set((data?.entries ?? []).map((e) => e.ageGroupId).filter((id) => id !== null));
    const groups = [...ids]
      .map((id) => ({ id, group: normalizeAgeGroup(id) }))
      .filter((e): e is { id: string; group: AgeGroup } => e.group !== null)
      .sort((a, b) => compareAgeGroups(a.group, b.group));
    const named = groups.map((e) => ({ value: e.id, label: e.group.label }));
    return [{ value: ALL_AGE_GROUPS, label: "全て" }, ...named];
  }, [data]);

  const named = view !== "division";
  const entries = useMemo(() => {
    const all = data?.entries ?? [];
    if (view === "friends") return all.filter((e) => e.isSelf === true);
    if (view === "age" && ageGroup !== ALL_AGE_GROUPS)
      return all.filter((e) => e.ageGroupId === ageGroup);
    return all;
  }, [data, view, ageGroup]);

  const x0 = named ? NAMED.x0 : DENSE.x0;
  const x1 = named ? NAMED.x1 : DENSE.x1;
  const height = named ? NAMED.top + entries.length * NAMED.rowH + 20 : DENSE.height;
  const axis = useMemo(() => buildAxis(checkpoints, x0, x1), [checkpoints, x0, x1]);
  const ticks = useMemo(() => buildTicks(checkpoints, axis), [checkpoints, axis]);
  // Swim and bike labels ride above the axis, run labels below, so they fit.
  const labels = useMemo(
    () => [
      ...thin(
        ticks.filter((t) => t.leg !== "run"),
        10,
      ),
      ...thin(
        ticks.filter((t) => t.leg === "run"),
        height - 4,
      ),
    ],
    [ticks, height],
  );

  const placed: readonly Placed[] = useMemo(
    () =>
      entries.map((entry, index) => {
        const { position } = entry;
        const km = position.inTransition ? position.estKm : projectKm(position, now);
        const leg = toLeg(position.discipline);
        return {
          entry,
          x: scaleKm(axis, leg, km),
          y: rowY(index, entries.length, named),
          km,
          leg,
          filled: position.waiting || position.inTransition || position.speedKmh <= 0,
        };
      }),
    [entries, axis, named, now],
  );

  const yTicks = useMemo(() => {
    const count = entries.length;
    const spacing = (DENSE.y1 - DENSE.y0) / Math.max(1, count - 1);
    const inner = Y_TICKS.filter((v) => v < count && (count - v) * spacing > 8);
    return [...inner, count].filter((value) => value > 0);
  }, [entries.length]);

  const activeIndex = Math.min(focusIndex, Math.max(0, placed.length - 1));
  const tip = placed.find((p) => p.entry.bib === selected) ?? null;
  const tipRank = tip?.entry.divisionRank ?? null;
  const toggle = (bib: string): void => setSelected((current) => (current === bib ? null : bib));

  /** Roving tabindex: the dot layer is one tab stop, arrows walk the field. */
  const onDotKey = (event: KeyboardEvent<SVGGElement>, index: number, bib: string): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle(bib);
      return;
    }
    if (event.key === "Escape") {
      setSelected(null);
      return;
    }
    const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
    if (!forward && event.key !== "ArrowUp" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = Math.min(Math.max(index + (forward ? 1 : -1), 0), placed.length - 1);
    setFocusIndex(next);
    dots.current.get(placed[next]?.entry.bib ?? "")?.focus();
  };

  return (
    <div className="flex flex-col gap-2">
      <Tabs
        aria-label="部門"
        className="mx-3"
        items={DIVISION_TABS}
        value={division}
        onValueChange={(value) => {
          if (isDivision(value)) setDivision(value);
          setSelected(null);
        }}
      />
      <Tabs
        aria-label="表示"
        variant="pill"
        className="mx-3"
        items={VIEW_TABS}
        value={view}
        onValueChange={(value) => {
          if (isView(value)) setView(value);
          setSelected(null);
          setFocusIndex(0);
        }}
      />

      <div className="mx-4 flex items-center justify-between gap-2 text-muted-foreground text-xs">
        <p>
          {division}タイプ <b className="text-foreground">{entries.length}</b> 名 · 上が速い
          {error ? ` · ${error}` : loading ? " · 読み込み中" : ""}
        </p>
        {view === "age" ? (
          <label className="flex shrink-0 items-center gap-1" htmlFor="map-age-group">
            年齢区分
            <Select
              id="map-age-group"
              aria-label="年齢区分"
              options={ageOptions}
              value={ageGroup}
              onValueChange={setAgeGroup}
            />
          </label>
        ) : null}
      </div>

      <div className="mx-3 rounded-lg border border-border bg-card p-2">
        {/* The tooltip is placed in viewBox percentages, so it must sit in a
            box that is exactly the SVG: no padding between the two. */}
        <div className="relative">
          <svg viewBox={`0 0 ${VIEW_W} ${height}`} className="block h-auto w-full">
            <title>{`${division}タイプの推定位置マップ`}</title>
            {LEGS.map((leg) => (
              <rect
                key={leg}
                x={axis[leg].x0}
                y={14}
                width={axis[leg].x1 - axis[leg].x0}
                height={6}
                rx={3}
                fill={LEG[leg].bg}
              />
            ))}
            <g stroke="var(--border)" strokeWidth={1} strokeDasharray="2 3">
              {ticks.map((tick) => (
                <line key={tick.id} x1={tick.x} y1={22} x2={tick.x} y2={height - 14} />
              ))}
            </g>
            <g fill="var(--muted-foreground)" fontSize={8.5}>
              {labels.map((label) => (
                <text
                  key={`${label.id}-${label.y}`}
                  x={label.x}
                  y={label.y}
                  textAnchor={anchorAt(label.x, x0, x1)}
                >
                  {label.label}
                </text>
              ))}
            </g>

            <g fill="var(--muted-foreground)" fontSize={named ? 9.5 : 8.5} textAnchor="end">
              {named
                ? placed.map((p, index) => (
                    <text
                      key={p.entry.bib}
                      x={x0 - 8}
                      y={p.y + 3}
                      fill={p.entry.isSelf === true ? "var(--foreground)" : undefined}
                    >
                      {index + 1} {p.entry.name}
                    </text>
                  ))
                : yTicks.map((value, index) => (
                    <text key={value} x={x0 - 6} y={rowY(value - 1, entries.length, false) + 3}>
                      {index === 0 ? `${value}位` : value}
                    </text>
                  ))}
            </g>

            {placed.map((p, index) => {
              const friend = p.entry.isSelf === true;
              const radius = friend ? FRIEND_DOT : named ? NAMED.dot : DENSE.dot;
              const color = friend ? "currentColor" : LEG[p.leg].color;
              return (
                // biome-ignore lint/a11y/useSemanticElements: a <button> cannot be an SVG child
                <g
                  key={p.entry.bib}
                  ref={(node) => {
                    if (node) dots.current.set(p.entry.bib, node);
                    else dots.current.delete(p.entry.bib);
                  }}
                  role="button"
                  tabIndex={index === activeIndex ? 0 : -1}
                  aria-label={`${p.entry.name} ${LEG[p.leg].label} ${p.km.toFixed(1)}km`}
                  className={cn("cursor-pointer", friend && "text-brand-cyan-400")}
                  onClick={() => {
                    setFocusIndex(index);
                    toggle(p.entry.bib);
                  }}
                  onKeyDown={(event) => onDotKey(event, index, p.entry.bib)}
                >
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={radius}
                    fill={p.filled ? color : "var(--card)"}
                    stroke={color}
                    strokeWidth={radius >= 3 ? 1.4 : 0.9}
                    strokeDasharray={p.filled ? undefined : "2 2"}
                  />
                  {friend && !named ? (
                    <text x={p.x + 8} y={p.y + 3} fontSize={9} fill="var(--foreground)">
                      {p.entry.name}
                      {p.entry.divisionRank ? ` ${p.entry.divisionRank.rank}位` : ""}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>

          {tip ? (
            <div
              className="-translate-x-1/2 -translate-y-full absolute z-10 w-max max-w-[220px] rounded-md border border-border bg-popover px-2 py-1 text-popover-foreground shadow-sm"
              style={{
                left: `${(tip.x / VIEW_W) * 100}%`,
                top: `${((tip.y - 6) / height) * 100}%`,
              }}
            >
              <p className="font-bold text-[12px]">{tip.entry.name}</p>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {tipRank ? `部門 ${tipRank.rank}/${tipRank.of} · ` : ""}
                {placed.indexOf(tip) + 1} 番目 · {LEG[tip.leg].label} {tip.km.toFixed(1)} km
              </p>
              <Link
                href={`/athletes/${tip.entry.bib}`}
                className="rounded-sm font-bold text-[11px] text-primary underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                詳細 ›
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      <ul className="mx-4 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {LEGEND.map((item) => (
          <li key={item.label} className="flex items-center gap-1">
            <span
              aria-hidden="true"
              className={cn("inline-block rounded-full", item.size)}
              style={item.color ? { backgroundColor: item.color } : undefined}
            />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
