"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { useBookmarks } from "@/hooks/useBookmarks";
import { projectKm, useLiveClock } from "@/hooks/useLivePosition";
import { useLiveResource, useRaceState } from "@/hooks/useSnapshot";
import type { LeaderboardDto } from "@/lib/api/leaderboard";
import { formatClockShort, formatDuration, formatKm } from "@/lib/format";
import { cn } from "@/lib/utils/cn";
import { PreRaceNotice } from "./PreRaceNotice";
import { StatusPill } from "./StatusPill";

const DIVISION_TABS = [
  { value: "A", label: "A" },
  { value: "B", label: "B" },
  { value: "RA", label: "RA" },
  { value: "RB", label: "RB" },
];

const MEDAL: Record<number, string> = {
  1: "text-[color:var(--bike)]",
  2: "text-[color:var(--bike)]",
  3: "text-[color:var(--bike)]",
};

/**
 * The front page: who is leading each division right now. Order is field
 * order rather than a cumulative rank, because ranks taken at different
 * checkpoints are not comparable, so the only honest answer to "who is
 * ahead" is who has come furthest and, among those, who got there fastest.
 */
export function Leaderboard() {
  const { race, fetchedAt, error, lastPolledAt, intervalMs, auto, setAuto, refresh } =
    useRaceState();
  const [division, setDivision] = useState("A");
  const [page, setPage] = useState(1);
  const { bibs, has } = useBookmarks();
  const now = useLiveClock();

  const { data: board, loading } = useLiveResource<LeaderboardDto>(
    `/api/leaderboard?div=${division}&page=${page}`,
    fetchedAt,
  );

  const lastPage = board ? Math.max(1, Math.ceil(board.total / board.perPage)) : 1;

  const changeDivision = (next: string): void => {
    setDivision(next);
    setPage(1);
  };

  return (
    <main className="mx-auto w-full max-w-[430px] pb-10">
      <PageHeader
        title="総合トップ"
        race={race}
        lastPolledAt={lastPolledAt}
        error={error}
        intervalMs={intervalMs}
        auto={auto}
        onAutoChange={setAuto}
        onRefresh={refresh}
        action={
          bibs.length > 0 ? (
            <Link
              href="/bookmarks"
              className="rounded font-semibold text-[12px] text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              ブックマーク {bibs.length} 人 ›
            </Link>
          ) : null
        }
      />

      <div className="px-3 pt-2.5 empty:hidden">
        <PreRaceNotice race={race} />
      </div>

      <Tabs
        items={DIVISION_TABS}
        value={division}
        onValueChange={changeDivision}
        aria-label="部門"
        className="mt-2.5"
      />

      {board ? (
        <p className="px-4 pt-2.5 text-[12px] text-muted-foreground tabular-nums">
          {board.label} · エントリー{" "}
          <b className="font-semibold text-foreground">{board.entrants}</b> 名
          {board.finished > 0 ? (
            <>
              {" · フィニッシュ "}
              <b className="font-semibold text-foreground">{board.finished}</b> 名
            </>
          ) : null}
          {board.order === "field" ? " · 先頭順 " : " · ゼッケン順 "}
          <b className="font-semibold text-foreground">{board.total}</b> 名
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5 px-3 pt-2">
        {loading && !board ? <Skeleton className="h-64 w-full rounded-lg" /> : null}

        {board?.leaders.length === 0 ? (
          <p className="rounded-lg border border-border border-dashed bg-card px-4 py-8 text-center text-[12.5px] text-muted-foreground">
            この部門のエントリーはありません。
          </p>
        ) : null}

        {board?.leaders.map(({ place, athlete }) => {
          const finished = athlete.status === "finished";
          const estKm = finished ? athlete.position.totalKm : projectKm(athlete.position, now);
          const bookmarked = has(athlete.bib);
          return (
            <Link
              key={athlete.bib}
              href={`/athletes/${athlete.bib}`}
              className={cn(
                "flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
                bookmarked ? "border-primary/60" : "border-border",
              )}
            >
              {/* Before anyone is measured the order is arbitrary, so a
                  position number would read as a rank it has not earned. */}
              {board.order === "field" ? (
                <span
                  className={cn(
                    "w-6 shrink-0 text-right font-bold text-[15px] tabular-nums",
                    MEDAL[place] ?? "text-muted-foreground",
                  )}
                >
                  {place}
                </span>
              ) : (
                <span className="w-6 shrink-0" aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-1.5">
                  <span className="truncate font-bold text-[14.5px]">{athlete.name}</span>
                  <span className="shrink-0 font-semibold text-[11.5px] text-muted-foreground tabular-nums">
                    #{athlete.bib}
                  </span>
                  {bookmarked ? (
                    <span className="shrink-0 text-[10px] text-primary">ブックマーク</span>
                  ) : null}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted-foreground tabular-nums">
                  <StatusPill athlete={athlete} />
                  {finished ? (
                    <span>
                      総合{" "}
                      <b className="font-semibold text-foreground">
                        {athlete.officialTotal ?? formatDuration(athlete.elapsedMs ?? 0)}
                      </b>
                    </span>
                  ) : (
                    <>
                      <span>
                        {athlete.lastCheckpointLabel ?? "未計測"}
                        {athlete.elapsedMs !== null
                          ? ` · ${formatDuration(athlete.elapsedMs)}`
                          : null}
                      </span>
                      <span>
                        約 {formatKm(estKm, athlete.position.discipline === "bike" ? 0 : 1)}
                      </span>
                    </>
                  )}
                </span>
              </span>
              {!finished && athlete.prediction ? (
                <span className="shrink-0 text-right">
                  <span className="block text-[10px] text-muted-foreground">ゴール予想</span>
                  <span className="block font-bold text-[14px] tabular-nums">
                    {formatClockShort(athlete.prediction.finishAt)}
                  </span>
                </span>
              ) : null}
              {athlete.ageGroupLabel ? (
                <span className="hidden shrink-0 text-[10.5px] text-muted-foreground sm:block">
                  {athlete.ageGroupLabel}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>

      {board && board.total > board.perPage ? (
        <nav
          aria-label="ページ送り"
          className="flex items-center justify-center gap-5 px-3 pt-3 font-semibold text-[12px] tabular-nums"
        >
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={page <= 1}
            className="rounded px-1 py-0.5 text-primary outline-none disabled:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            ‹ 前へ
          </button>
          <span className="text-muted-foreground">
            {board.page} / {lastPage}
            <span className="ml-1.5">
              （{(board.page - 1) * board.perPage + 1}〜
              {Math.min(board.page * board.perPage, board.total)} 位）
            </span>
          </span>
          <button
            type="button"
            onClick={() => setPage((value) => Math.min(lastPage, value + 1))}
            disabled={page >= lastPage}
            className="rounded px-1 py-0.5 text-primary outline-none disabled:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            次へ ›
          </button>
        </nav>
      ) : null}
    </main>
  );
}
