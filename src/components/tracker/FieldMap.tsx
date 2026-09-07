"use client";

import Link from "next/link";
import { type KeyboardEvent, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import {
  type AgeGroup,
  compareAgeGroups,
  DISCIPLINE_LABELS,
  DISCIPLINES,
  DIVISIONS,
  type Discipline,
  type Division,
  isDivision,
  normalizeAgeGroup,
} from "@/config/races";
import { useBookmarks } from "@/hooks/useBookmarks";
import { projectKm, useLiveClock } from "@/hooks/useLivePosition";
import { useQueryState } from "@/hooks/useQueryState";
import { useLiveResource, useRaceState } from "@/hooks/useSnapshot";
import type { CheckpointDto, MapEntryDto, MapResponseDto } from "@/lib/api/contract";
import {
  type Anchor,
  type Axis,
  buildAxis,
  buildTicks,
  fitLabels,
  kmTicks,
  scaleKm,
  type Tick,
  toLeg,
} from "@/lib/chart/courseAxis";
import { cn } from "@/lib/utils/cn";

type View = "division" | "age" | "friends";

interface Placed {
  readonly entry: MapEntryDto;
  readonly x: number;
  readonly y: number;
  readonly km: number;
  readonly leg: Discipline;
  /** Measured at a timing point, as opposed to projected forward from one. */
  readonly filled: boolean;
}

const LEG: Readonly<Record<Discipline, { color: string; bg: string }>> = {
  swim: { color: "var(--swim)", bg: "var(--swim-bg)" },
  bike: { color: "var(--bike)", bg: "var(--bike-bg)" },
  run: { color: "var(--run)", bg: "var(--run-bg)" },
};

const DIVISION_TABS = DIVISIONS.map((value) => ({ value, label: value }));
const VIEW_TABS = [
  { value: "division", label: "総合" },
  { value: "age", label: "エイジ別" },
  { value: "friends", label: "ブックマークのみ" },
] as const;
const LEGEND = [
  ...DISCIPLINES.map((leg) => ({
    label: `${DISCIPLINE_LABELS[leg]}中`,
    size: "size-1.5",
    color: LEG[leg].color,
  })),
  { label: "ブックマーク", size: "size-2 bg-brand-cyan-400", color: undefined },
];

const VIEW_W = 360;
/** One named row per athlete: the label column, then the course. */
const PLOT = { x0: 84, x1: 352, top: 24, rowH: 16, foot: 22, dot: 4 };
const FRIEND_DOT = 5;
/** Share of the field that makes a waiting cluster worth calling out. */
const CLUMP_SHARE = 0.1;
const MIN_KM_GAP = 40;

const EMPTY_MESSAGE: Readonly<Record<View, string>> = {
  division: "計測中の選手がいません。",
  age: "この年齢区分に計測中の選手がいません。",
  friends: "選手をブックマークすると、ここに並びます。",
};

/** Rows run top to bottom: the leader first, then one row per athlete. */
const rowY = (index: number): number => PLOT.top + 10 + index * PLOT.rowH;

/** Keep the outermost labels inside the viewBox instead of centring them. */
const anchorAt = (x: number): Anchor =>
  x <= PLOT.x0 + 20 ? "start" : x >= PLOT.x1 - 20 ? "end" : "middle";

/**
 * Only the points that frame a leg carry a label: the start, each leg's end,
 * and the bike leg's three named points. The eleven `ラン{n}km` splits would
 * collide with each other, so they stay as unlabelled ticks and the run band
 * gets a sparse km scale underneath instead.
 */
const isLabelled = (tick: Tick, axis: Axis): boolean =>
  tick.id === "start" || tick.leg === "bike" || tick.x >= axis[tick.leg].x1 - 0.5;

const isView = (value: string): value is View => VIEW_TABS.some((tab) => tab.value === value);

/**
 * Every racing athlete as one dot: how far along the course on the x axis,
 * field order on the y axis with the leader at the top. Dots advance between
 * server updates because the estimate is recomputed in the browser, and a dot
 * is hollow while its position is projected rather than measured.
 *
 * Every row is named. The division view runs to hundreds of rows and the
 * page becomes very long, which is the point: a dot with no name tells a
 * supporter nothing about who is where.
 */
export function FieldMap({ initialDivision }: { readonly initialDivision: Division }) {
  const [division, setDivision] = useState<Division>(initialDivision);
  const [view, setView] = useState<View>("division");
  const [ageGroup, setAgeGroup] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const dots = useRef(new Map<string, SVGGElement>());

  const {
    race,
    fetchedAt,
    error: raceError,
    lastPolledAt,
    intervalMs,
    auto,
    setAuto,
    refresh,
  } = useRaceState();
  const { bibs, ready } = useBookmarks();
  const now = useLiveClock();
  const { update } = useQueryState();

  const friends = bibs.map(encodeURIComponent).join(",");
  const url = ready ? `/api/map?div=${division}${friends ? `&bibs=${friends}` : ""}` : null;
  const { data, error, loading } = useLiveResource<MapResponseDto>(url, fetchedAt);

  const checkpoints: readonly CheckpointDto[] =
    race?.divisions.find((entry) => entry.id === division)?.checkpoints ?? [];

  // One unfiltered fetch feeds all three views, so the age list is complete.
  // There is deliberately no "all" option: a named row per athlete only reads
  // at a few dozen rows, and the whole division would be a 900-row strip.
  const ageOptions = useMemo(() => {
    const ids = new Set((data?.entries ?? []).map((e) => e.ageGroupId).filter((id) => id !== null));
    return [...ids]
      .map((id) => ({ id, group: normalizeAgeGroup(id) }))
      .filter((e): e is { id: string; group: AgeGroup } => e.group !== null)
      .sort((a, b) => compareAgeGroups(a.group, b.group))
      .map((e) => ({ value: e.id, label: e.group.label }));
  }, [data]);

  // A stored choice can be invalid after a division switch, and relay
  // divisions carry no age groups at all.
  const activeAge =
    ageOptions.find((option) => option.value === ageGroup)?.value ?? ageOptions[0]?.value ?? null;

  const entries = useMemo(() => {
    const all = data?.entries ?? [];
    if (view === "friends") return all.filter((e) => e.isSelf === true);
    if (view === "age") return all.filter((e) => e.ageGroupId === activeAge && activeAge !== null);
    return all;
  }, [data, view, activeAge]);

  const height = PLOT.top + entries.length * PLOT.rowH + PLOT.foot;
  const axis = useMemo(() => buildAxis(checkpoints, PLOT.x0, PLOT.x1), [checkpoints]);
  const ticks = useMemo(() => buildTicks(checkpoints, axis), [checkpoints, axis]);
  const labels = useMemo(
    () =>
      fitLabels(
        ticks
          .filter((tick) => isLabelled(tick, axis))
          .map((tick) => ({ key: tick.id, text: tick.label, x: tick.x, anchor: anchorAt(tick.x) })),
        { keepLast: true },
      ),
    [ticks, axis],
  );
  const kmScale = useMemo(() => kmTicks(axis.run, MIN_KM_GAP), [axis]);

  const placed: readonly Placed[] = useMemo(
    () =>
      entries.map((entry, index) => {
        const { position } = entry;
        const km = projectKm(position, now);
        const leg = toLeg(position.discipline);
        return {
          entry,
          x: scaleKm(axis, leg, km),
          y: rowY(index),
          km,
          leg,
          filled: position.waiting || position.inTransition || position.speedKmh <= 0,
        };
      }),
    [entries, axis, now],
  );

  /**
   * The server caps an estimate at the next timing point, so a long gap
   * between two points parks a large part of the field on one x position.
   * Without a word of explanation that column reads as a rendering fault.
   */
  const clump = useMemo(() => {
    if (placed.length === 0) return null;
    const counts = new Map<string, number>();
    for (const p of placed) {
      if (!p.entry.position.waiting) continue;
      const at = p.entry.position.lastCheckpointLabel ?? "スタート";
      counts.set(at, (counts.get(at) ?? 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!top || top[1] < placed.length * CLUMP_SHARE) return null;
    return { label: top[0], count: top[1] };
  }, [placed]);

  const activeIndex = Math.min(focusIndex, Math.max(0, placed.length - 1));
  const tip = placed.find((p) => p.entry.bib === selected) ?? null;
  const tipRank = tip?.entry.divisionRank ?? null;
  const toggle = (bib: string): void => setSelected((current) => (current === bib ? null : bib));

  const changeDivision = (value: string): void => {
    if (!isDivision(value)) return;
    setDivision(value);
    setSelected(null);
    // The address carries the division so the view can be shared; the
    // default reads cleanest as no query at all.
    update({ div: value === "A" ? null : value });
  };

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
      <PageHeader
        title="全体マップ"
        subtitle="推定位置"
        documentTitle="全体マップ"
        race={race}
        lastPolledAt={lastPolledAt}
        error={raceError}
        intervalMs={intervalMs}
        auto={auto}
        onAutoChange={setAuto}
        onRefresh={refresh}
      />
      <Tabs
        aria-label="タイプ"
        className="mx-3"
        items={DIVISION_TABS}
        value={division}
        onValueChange={changeDivision}
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
        {view === "age" && activeAge !== null ? (
          <label className="flex shrink-0 items-center gap-1" htmlFor="map-age-group">
            年齢区分
            <Select
              id="map-age-group"
              aria-label="年齢区分"
              options={ageOptions}
              value={activeAge}
              onValueChange={(value) => {
                setAgeGroup(value);
                setSelected(null);
                setFocusIndex(0);
              }}
            />
          </label>
        ) : null}
      </div>

      <div className="mx-3 rounded-lg border border-border bg-card p-2">
        {entries.length === 0 ? (
          <p className="px-2 py-6 text-center text-muted-foreground text-xs">
            {loading ? "読み込み中" : EMPTY_MESSAGE[view]}
          </p>
        ) : (
          // The tooltip is placed in viewBox percentages, so it must sit in a
          // box that is exactly the SVG: no padding between the two.
          <div className="relative">
            <svg viewBox={`0 0 ${VIEW_W} ${height}`} className="block h-auto w-full">
              <title>{`${division}タイプの推定位置マップ`}</title>
              {DISCIPLINES.map((leg) => (
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
                  <text key={label.key} x={label.x} y={10} textAnchor={label.anchor}>
                    {label.text}
                  </text>
                ))}
              </g>
              <g fill="var(--muted-foreground)" fontSize={8}>
                {kmScale.map((mark) => (
                  <text key={mark.km} x={mark.x} y={height - 6} textAnchor={anchorAt(mark.x)}>
                    {mark.km}km
                  </text>
                ))}
              </g>

              <g fill="var(--muted-foreground)" fontSize={9.5} textAnchor="end">
                {placed.map((p, index) => (
                  // A name is the obvious thing to tap, so it goes straight
                  // to the athlete rather than to a tooltip.
                  <a
                    key={p.entry.bib}
                    href={`/athletes/${p.entry.bib}`}
                    aria-label={`${p.entry.name} の詳細`}
                    className="cursor-pointer outline-none focus-visible:underline"
                  >
                    <text
                      x={PLOT.x0 - 8}
                      y={p.y + 3}
                      fill={p.entry.isSelf === true ? "var(--foreground)" : undefined}
                      className="hover:underline"
                    >
                      {index + 1} {p.entry.name}
                    </text>
                  </a>
                ))}
              </g>

              {placed.map((p, index) => {
                const friend = p.entry.isSelf === true;
                const radius = friend ? FRIEND_DOT : PLOT.dot;
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
                    aria-label={`${p.entry.name} ${DISCIPLINE_LABELS[p.leg]} ${p.km.toFixed(1)}km`}
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
                      strokeWidth={1.4}
                      strokeDasharray={p.filled ? undefined : "2 2"}
                    />
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
                <Link
                  href={`/athletes/${tip.entry.bib}`}
                  className="rounded-sm font-bold text-[12px] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {tip.entry.name}
                  <span className="ml-1 font-bold text-[11px] text-primary">›</span>
                </Link>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {tipRank ? `総合 ${tipRank.rank}/${tipRank.of} · ` : ""}
                  {placed.indexOf(tip) + 1} 番目 · {DISCIPLINE_LABELS[tip.leg]} {tip.km.toFixed(1)}{" "}
                  km
                </p>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {clump ? (
        <p className="mx-4 text-[11px] text-muted-foreground">
          うち <b className="text-foreground">{clump.count}</b> 名は {clump.label}{" "}
          から次の計測点までの区間にいます。正確な位置は計測待ちです。
        </p>
      ) : null}

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
