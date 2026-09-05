"use client";

import Link from "next/link";
import { type KeyboardEvent, useMemo, useRef, useState } from "react";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { type AgeGroup, type Division, compareAgeGroups, normalizeAgeGroup } from "@/config/races";
import { useBookmarks } from "@/hooks/useBookmarks";
import { projectKm, useLiveClock } from "@/hooks/useLivePosition";
import { useLiveResource, useRaceState } from "@/hooks/useSnapshot";
import type { MapEntryDto } from "@/lib/api/contract";
import { cn } from "@/lib/utils/cn";

type Leg = "swim" | "bike" | "run";
type View = "division" | "age" | "friends";

const LEG_SHARE: Readonly<Record<Leg, number>> = { swim: 0.22, bike: 0.48, run: 0.3 };
const LEG_COLOR: Readonly<Record<Leg, string>> = {
  swim: "var(--swim)",
  bike: "var(--bike)",
  run: "var(--run)",
};
const LEG_BG: Readonly<Record<Leg, string>> = {
  swim: "var(--swim-bg)",
  bike: "var(--bike-bg)",
  run: "var(--run-bg)",
};
const LEG_LABEL: Readonly<Record<Leg, string>> = { swim: "スイム", bike: "バイク", run: "ラン" };

const DIVISION_TABS = [
  { value: "A", label: "A" },
  { value: "B", label: "B" },
  { value: "RA", label: "RA" },
  { value: "RB", label: "RB" },
] as const;
const VIEW_TABS = [
  { value: "division", label: "部門総合" },
  { value: "age", label: "エイジ別" },
  { value: "friends", label: "友達だけ" },
] as const;

const VIEW_W = 360;
const DENSE = { x0: 40, x1: 356, y0: 26, y1: 236, height: 250, dot: 1.6 };
const NAMED = { x0: 84, x1: 352, top: 24, rowH: 16, dot: 4 };
const FRIEND_DOT = 5;
const LABEL_GAP = 26;
const ALL_AGE_GROUPS = "all";
const Y_TICKS = [1, 250, 500, 750];

interface Checkpoint {
  readonly id: string;
  readonly label: string;
  readonly km: number;
  readonly discipline: string;
}
interface Band {
  readonly x0: number;
  readonly x1: number;
  readonly km: number;
}
type Axis = Readonly<Record<Leg, Band>>;
interface Tick {
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly leg: Leg;
}
interface Placed {
  readonly entry: MapEntryDto;
  readonly x: number;
  readonly y: number;
  readonly km: number;
  readonly leg: Leg;
  readonly filled: boolean;
}
interface MapPayload {
  readonly division: Division;
  readonly count: number;
  readonly entries: readonly MapEntryDto[];
}

/** Transition points sit on the bike leg; everything else maps to its own leg. */
const toLeg = (discipline: string): Leg =>
  discipline === "swim" || discipline === "run" ? discipline : "bike";

/** Three fixed-width bands, each scaled to the length of its own leg. */
function buildAxis(checkpoints: readonly Checkpoint[], x0: number, x1: number): Axis {
  const width = x1 - x0;
  const legKm = (leg: Leg): number =>
    checkpoints.reduce((max, c) => (toLeg(c.discipline) === leg ? Math.max(max, c.km) : max), 0);
  const swimW = width * LEG_SHARE.swim;
  const bikeW = width * LEG_SHARE.bike;
  return {
    swim: { x0, x1: x0 + swimW, km: legKm("swim") },
    bike: { x0: x0 + swimW, x1: x0 + swimW + bikeW, km: legKm("bike") },
    run: { x0: x0 + swimW + bikeW, x1, km: legKm("run") },
  };
}

/** Kilometres within a leg to a course-wide x coordinate. */
function scaleKm(axis: Axis, leg: Leg, km: number): number {
  const band = axis[leg];
  const ratio = band.km > 0 ? Math.min(Math.max(km / band.km, 0), 1) : 0;
  return band.x0 + (band.x1 - band.x0) * ratio;
}

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
function thin(ticks: readonly Tick[], gap: number): Tick[] {
  return ticks.reduce<Tick[]>((kept, tick, index) => {
    const last = kept[kept.length - 1];
    if (last === undefined || tick.x - last.x >= gap) return [...kept, tick];
    return index === ticks.length - 1 ? [...kept.slice(0, -1), tick] : kept;
  }, []);
}

const anchorAt = (x: number, x0: number, x1: number): "start" | "middle" | "end" =>
  x <= x0 + 4 ? "start" : x >= x1 - 4 ? "end" : "middle";

const isView = (value: string): value is View => VIEW_TABS.some((tab) => tab.value === value);
const isDivision = (value: string): value is Division =>
  DIVISION_TABS.some((tab) => tab.value === value);

/**
 * Every racing athlete as one dot: how far along the course on the x axis,
 * field order on the y axis with the leader at the top. Dots advance between
 * server updates because the estimate is recomputed in the browser.
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

  const url = ready
    ? `/api/map?div=${division}${bibs.length > 0 ? `&bibs=${bibs.map(encodeURIComponent).join(",")}` : ""}`
    : null;
  const { data, error, loading } = useLiveResource<MapPayload>(url, fetchedAt);

  const checkpoints: readonly Checkpoint[] =
    race?.divisions.find((entry) => entry.id === division)?.checkpoints ?? [];

  const ageOptions = useMemo(() => {
    const ids = [
      ...new Set((data?.entries ?? []).map((e) => e.ageGroupId).filter((id) => id !== null)),
    ];
    const groups = ids
      .map((id) => ({ id, group: normalizeAgeGroup(id) }))
      .filter((e): e is { id: string; group: AgeGroup } => e.group !== null)
      .sort((a, b) => compareAgeGroups(a.group, b.group));
    return [
      { value: ALL_AGE_GROUPS, label: "全て" },
      ...groups.map((e) => ({ value: e.id, label: e.group.label })),
    ];
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
  const topLabels = useMemo(() => thin(ticks.filter((t) => t.leg !== "run"), LABEL_GAP), [ticks]);
  const bottomLabels = useMemo(() => thin(ticks.filter((t) => t.leg === "run"), LABEL_GAP), [ticks]);

  const placed: readonly Placed[] = useMemo(
    () =>
      entries.map((entry, index) => {
        const { position } = entry;
        const km = position.inTransition ? position.estKm : projectKm(position, now);
        const leg = toLeg(position.discipline);
        const y = named
          ? NAMED.top + 10 + index * NAMED.rowH
          : DENSE.y0 +
            ((DENSE.y1 - DENSE.y0) * index) / Math.max(1, entries.length - 1);
        return {
          entry,
          x: scaleKm(axis, leg, km),
          y,
          km,
          leg,
          filled: position.waiting || position.speedKmh <= 0,
        };
      }),
    [entries, axis, named, now],
  );

  const yTicks = useMemo(() => {
    const count = entries.length;
    const spacing = (DENSE.y1 - DENSE.y0) / Math.max(1, count - 1);
    return [
      ...Y_TICKS.filter((value) => value < count && (count - value) * spacing > 8),
      count,
    ].filter((value) => value > 0);
  }, [entries.length]);

  const activeIndex = Math.min(focusIndex, Math.max(0, placed.length - 1));
  const tip = placed.find((p) => p.entry.bib === selected) ?? null;
  const tipRank = tip?.entry.divisionRank ?? null;

  const onDotKey = (event: KeyboardEvent<SVGGElement>, index: number, bib: string): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelected((current) => (current === bib ? null : bib));
      return;
    }
    if (event.key === "Escape") {
      setSelected(null);
      return;
    }
    const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
    const back = event.key === "ArrowUp" || event.key === "ArrowLeft";
    if (!forward && !back) return;
    event.preventDefault();
    const next = Math.min(Math.max(index + (forward ? 1 : -1), 0), placed.length - 1);
    setFocusIndex(next);
    const target = placed[next];
    if (target) dots.current.get(target.entry.bib)?.focus();
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

      <div className="relative mx-3 rounded-lg border border-border bg-card p-2">
        <svg
          viewBox={`0 0 ${VIEW_W} ${height}`}
          className="block h-auto w-full"
          style={{ fontFamily: "inherit" }}
        >
          <title>{`${division}タイプの推定位置マップ`}</title>
          {(["swim", "bike", "run"] as const).map((leg) => (
            <rect
              key={leg}
              x={axis[leg].x0}
              y={14}
              width={axis[leg].x1 - axis[leg].x0}
              height={6}
              rx={3}
              fill={LEG_BG[leg]}
            />
          ))}
          <g stroke="var(--border)" strokeWidth={1} strokeDasharray="2 3">
            {ticks.map((tick) => (
              <line key={tick.id} x1={tick.x} y1={22} x2={tick.x} y2={height - 14} />
            ))}
          </g>
          <g fill="var(--muted-foreground)" fontSize={8.5}>
            {topLabels.map((tick) => (
              <text key={tick.id} x={tick.x} y={10} textAnchor={anchorAt(tick.x, x0, x1)}>
                {tick.label}
              </text>
            ))}
            {bottomLabels.map((tick) => (
              <text
                key={tick.id}
                x={tick.x}
                y={height - 4}
                textAnchor={anchorAt(tick.x, x0, x1)}
              >
                {tick.label}
              </text>
            ))}
          </g>

          {named ? (
            <g fill="var(--muted-foreground)" fontSize={9.5} textAnchor="end">
              {placed.map((p, index) => (
                <text
                  key={p.entry.bib}
                  x={x0 - 8}
                  y={p.y + 3}
                  fill={p.entry.isSelf === true ? "var(--foreground)" : undefined}
                  fontWeight={p.entry.isSelf === true ? 700 : undefined}
                >
                  {index + 1} {p.entry.name}
                </text>
              ))}
            </g>
          ) : (
            <g fill="var(--muted-foreground)" fontSize={8.5} textAnchor="end">
              {yTicks.map((value, index) => (
                <text
                  key={value}
                  x={x0 - 6}
                  y={
                    DENSE.y0 +
                    ((DENSE.y1 - DENSE.y0) * (value - 1)) / Math.max(1, entries.length - 1) +
                    3
                  }
                >
                  {index === 0 ? `${value}位` : value}
                </text>
              ))}
            </g>
          )}

          {placed.map((p, index) => {
            const friend = p.entry.isSelf === true;
            const radius = friend ? FRIEND_DOT : named ? NAMED.dot : DENSE.dot;
            const color = friend ? "currentColor" : LEG_COLOR[p.leg];
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
                aria-label={`${p.entry.name} ${LEG_LABEL[p.leg]} ${p.km.toFixed(1)}km`}
                className={cn("cursor-pointer", friend && "text-brand-cyan-400")}
                onClick={() => {
                  setFocusIndex(index);
                  setSelected((current) => (current === p.entry.bib ? null : p.entry.bib));
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
                  <text
                    x={p.x + 8}
                    y={p.y + 3}
                    fontSize={9}
                    fontWeight={700}
                    fill="var(--foreground)"
                  >
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
            style={{ left: `${(tip.x / VIEW_W) * 100}%`, top: `${((tip.y - 6) / height) * 100}%` }}
          >
            <p className="font-bold text-[12px]">{tip.entry.name}</p>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {tipRank ? `部門 ${tipRank.rank}/${tipRank.of} · ` : ""}
              {placed.indexOf(tip) + 1} 番目 · {LEG_LABEL[tip.leg]} {tip.km.toFixed(1)} km
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

      <ul className="mx-4 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {(["swim", "bike", "run"] as const).map((leg) => (
          <li key={leg} className="flex items-center gap-1">
            <span
              aria-hidden="true"
              className="inline-block size-1.5 rounded-full"
              style={{ backgroundColor: LEG_COLOR[leg] }}
            />
            {LEG_LABEL[leg]}中
          </li>
        ))}
        <li className="flex items-center gap-1">
          <span
            aria-hidden="true"
            className="inline-block size-2 rounded-full bg-brand-cyan-400"
          />
          友達
        </li>
      </ul>
    </div>
  );
}
