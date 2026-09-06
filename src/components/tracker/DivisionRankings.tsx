"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { RankingTable } from "@/components/tracker/RankingTable";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { type AgeGroup, compareAgeGroups, type Division, normalizeAgeGroup } from "@/config/races";
import { useLiveResource, useRaceState } from "@/hooks/useSnapshot";
import type { RankingPageDto } from "@/lib/api/contract";
import { cn } from "@/lib/utils/cn";

const DIVISIONS: readonly Division[] = ["A", "B", "RA", "RB"];
const ALL_AGE_GROUPS = "all";

const DISCIPLINES = [
  { value: "swim", label: "スイム" },
  { value: "bike", label: "バイク" },
  { value: "run", label: "ラン" },
  { value: "total", label: "総合" },
] as const;

type RankingDiscipline = (typeof DISCIPLINES)[number]["value"];

const isDiscipline = (value: string): value is RankingDiscipline =>
  DISCIPLINES.some((item) => item.value === value);

/** The checkpoint an athlete must have passed to appear in each table. */
const END_CHECKPOINT: Readonly<Record<RankingDiscipline, string>> = {
  swim: "swimF",
  bike: "runS",
  run: "finish",
  total: "finish",
};

/** Below this, a table reads as broken rather than as an early leaderboard. */
const MIN_RANKED = 20;
const LADDER: readonly RankingDiscipline[] = ["total", "run", "bike", "swim"];

/**
 * Mid-race the finisher table holds one or two names, which looks like a bug.
 * Open on the furthest discipline that a real field has completed instead.
 */
function autoDiscipline(counts: Readonly<Record<string, number>>): RankingDiscipline {
  return LADDER.find((value) => (counts[END_CHECKPOINT[value]] ?? 0) >= MIN_RANKED) ?? "swim";
}

interface DivisionRankingsProps {
  readonly division: Division;
  readonly initialDiscipline: string | null;
  readonly initialAgeGroup: string | null;
  readonly initialBib: string | null;
  readonly initialPage: number;
}

/** Age groups seen so far in this division; the API exposes no group list. */
interface KnownGroups {
  readonly division: Division;
  readonly ids: readonly string[];
}

/** Writes the current view into the address bar without adding a history entry. */
function syncUrl(discipline: string | null, ageGroup: string, page: number): void {
  const next = new URL(window.location.href);
  if (discipline === null) next.searchParams.delete("discipline");
  else next.searchParams.set("discipline", discipline);
  if (ageGroup === ALL_AGE_GROUPS) next.searchParams.delete("ageGroup");
  else next.searchParams.set("ageGroup", ageGroup);
  if (page <= 1) next.searchParams.delete("page");
  else next.searchParams.set("page", String(page));
  window.history.replaceState(null, "", next.toString());
}

/** Query string carried across the division tabs, page number excluded. */
function tabQuery(discipline: string | null, ageGroup: string, bib: string | null): string {
  const params = new URLSearchParams();
  if (discipline !== null) params.set("discipline", discipline);
  if (ageGroup !== ALL_AGE_GROUPS) params.set("ageGroup", ageGroup);
  if (bib) params.set("bib", bib);
  return `?${params.toString()}`;
}

/**
 * Ranking tables for one division. Only athletes who have completed the
 * chosen discipline appear, so the header states how many that is and a
 * target athlete who is still out on the course gets a line of their own.
 */
export function DivisionRankings({
  division,
  initialDiscipline,
  initialAgeGroup,
  initialBib,
  initialPage,
}: DivisionRankingsProps) {
  const fromUrl =
    initialDiscipline !== null && isDiscipline(initialDiscipline) ? initialDiscipline : null;
  // Null until the race counts arrive and pick an opening discipline; an
  // explicit choice, from the URL or a tab, is authoritative from then on.
  const [discipline, setDiscipline] = useState<RankingDiscipline | null>(fromUrl);
  const [explicit, setExplicit] = useState(fromUrl !== null);
  const [ageGroup, setAgeGroup] = useState(initialAgeGroup ?? ALL_AGE_GROUPS);
  const [page, setPage] = useState(initialPage);
  const [known, setKnown] = useState<KnownGroups>({ division, ids: [] });

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

  useEffect(() => {
    if (discipline !== null) return;
    if (race) setDiscipline(autoDiscipline(race.counts[division]));
    else if (raceError !== null) setDiscipline("total");
  }, [discipline, race, raceError, division]);

  const url =
    discipline === null
      ? null
      : `/api/divisions/${division}/rankings?discipline=${discipline}&page=${page}` +
        (ageGroup === ALL_AGE_GROUPS ? "" : `&ageGroup=${encodeURIComponent(ageGroup)}`) +
        (initialBib ? `&bib=${encodeURIComponent(initialBib)}` : "");

  const { data, error, loading } = useLiveResource<RankingPageDto>(url, fetchedAt);

  useEffect(() => {
    syncUrl(explicit ? discipline : null, ageGroup, page);
  }, [explicit, discipline, ageGroup, page]);

  useEffect(() => {
    if (!data) return;
    const seen = data.rows
      .map((row) => row.ageGroupId)
      .filter((id): id is string => id !== null && id !== "");
    setKnown((previous) => {
      if (previous.division !== division) return { division, ids: [...new Set(seen)] };
      const merged = [...new Set([...previous.ids, ...seen])];
      return merged.length === previous.ids.length ? previous : { division, ids: merged };
    });
  }, [data, division]);

  const ageOptions = useMemo(() => {
    const ids = ageGroup === ALL_AGE_GROUPS ? known.ids : [...new Set([ageGroup, ...known.ids])];
    const groups = ids
      .map((id) => ({ id, group: normalizeAgeGroup(id) }))
      .filter((entry): entry is { id: string; group: AgeGroup } => entry.group !== null)
      .sort((a, b) => compareAgeGroups(a.group, b.group));
    return [
      { value: ALL_AGE_GROUPS, label: "全て" },
      ...groups.map((entry) => ({ value: entry.id, label: entry.group.label })),
    ];
  }, [known, ageGroup]);

  const currentPage = data?.page ?? page;
  const lastPage = data ? Math.max(1, Math.ceil(data.total / data.perPage)) : 1;

  return (
    <div className="flex flex-col gap-2">
      <PageHeader
        title="種目別順位"
        subtitle={`${division}タイプ`}
        race={race}
        lastPolledAt={lastPolledAt}
        error={raceError}
        intervalMs={intervalMs}
        auto={auto}
        onAutoChange={setAuto}
        onRefresh={refresh}
      />
      <nav aria-label="タイプ" className="mx-3 flex gap-[3px] rounded-lg bg-muted p-[3px]">
        {DIVISIONS.map((id) => (
          <Link
            key={id}
            href={`/divisions/${id}${tabQuery(explicit ? discipline : null, ageGroup, initialBib)}`}
            aria-current={id === division ? "page" : undefined}
            className={cn(
              "flex-1 rounded-md px-2 py-2 text-center font-bold text-[13px] outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring",
              id === division ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {id}
          </Link>
        ))}
      </nav>

      <Tabs
        aria-label="種目"
        variant="pill"
        className="mx-3"
        items={DISCIPLINES}
        value={discipline ?? ""}
        onValueChange={(value) => {
          if (!isDiscipline(value)) return;
          setDiscipline(value);
          setExplicit(true);
          setPage(1);
        }}
      />

      <div className="mx-4 flex items-center justify-between gap-2 text-muted-foreground text-xs">
        <p>
          {data ? (
            <>
              {data.measuredAt} <b className="text-foreground">{data.total}</b> 名中
              {data.discipline === "total" ? "" : " · 暫定"}
            </>
          ) : (
            (error ?? (loading || discipline === null ? "読み込み中" : "データがありません"))
          )}
        </p>
        <label className="flex shrink-0 items-center gap-1" htmlFor="age-group">
          年齢区分
          <Select
            id="age-group"
            aria-label="年齢区分"
            options={ageOptions}
            value={ageGroup}
            onValueChange={(value) => {
              setAgeGroup(value);
              setPage(1);
            }}
          />
        </label>
      </div>

      {data?.targetElsewhere ? (
        <p
          role="status"
          className="mx-3 rounded-lg bg-muted px-3 py-2 text-center font-bold text-[12.5px]"
        >
          ▲ {data.targetElsewhere.message}
        </p>
      ) : null}

      {/* The column heads follow the payload, so they never describe a
          discipline the rows do not belong to. */}
      {data ? (
        <RankingTable rows={data.rows} discipline={data.discipline} diffBasis={data.diffBasis} />
      ) : null}

      <div className="flex items-center justify-center gap-4 py-2 font-semibold text-muted-foreground text-xs tabular-nums">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => setPage(Math.max(1, currentPage - 1))}
          className="rounded-md px-2 py-1 text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:text-muted-foreground disabled:opacity-50"
        >
          ‹ 前へ
        </button>
        <span>
          {currentPage} / {lastPage}
        </span>
        <button
          type="button"
          disabled={currentPage >= lastPage}
          onClick={() => setPage(Math.min(lastPage, currentPage + 1))}
          className="rounded-md px-2 py-1 text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:text-muted-foreground disabled:opacity-50"
        >
          次へ ›
        </button>
      </div>
    </div>
  );
}
