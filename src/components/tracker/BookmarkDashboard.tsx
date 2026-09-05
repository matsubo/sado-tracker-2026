"use client";

import Link from "next/link";
import { useMemo } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { useBookmarkNotifications } from "@/hooks/useBookmarkNotifications";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useLiveResource, useRaceState } from "@/hooks/useSnapshot";
import type { AthleteSummaryDto } from "@/lib/api/contract";
import type { WeatherData } from "@/lib/weather/types";
import { AthleteCard } from "./AthleteCard";
import { barCheckpoints, legDistances } from "./PositionBar";
import { PreRaceNotice } from "./PreRaceNotice";
import { SearchBox } from "./SearchBox";
import { WeatherPanel } from "./WeatherPanel";

interface AthletesResponse {
  readonly athletes: readonly AthleteSummaryDto[];
  readonly missing: readonly string[];
}

/**
 * The friend dashboard. Everything refreshes in place: a small race endpoint
 * is polled, and the heavier data is refetched only when its update time
 * changes, so the page never reloads under the reader.
 */
export function BookmarkDashboard() {
  const { race, fetchedAt, error: raceError, lastPolledAt, intervalMs } = useRaceState();
  const { bibs, ready, add, remove, has } = useBookmarks();
  // The bell lives in the header; the cards only need to know what is new.
  const { items } = useBookmarkNotifications();

  const athletesUrl = ready && bibs.length > 0 ? `/api/athletes?bibs=${bibs.join(",")}` : null;
  const { data, loading } = useLiveResource<AthletesResponse>(athletesUrl, fetchedAt);
  const { data: weather } = useLiveResource<WeatherData>("/api/weather", null);

  const athletes = useMemo(() => data?.athletes ?? [], [data]);

  const divisionOf = (athlete: AthleteSummaryDto) =>
    race?.divisions.find((entry) => entry.id === athlete.division);

  /** Leg distances for the athlete's division, so ticks show on every leg. */
  const legKmOf = (athlete: AthleteSummaryDto) => ({
    ...legDistances(divisionOf(athlete)?.checkpoints),
    [athlete.position.discipline]: athlete.position.totalKm,
  });

  const nextLabelOf = (athlete: AthleteSummaryDto): string | null => {
    const division = race?.divisions.find((d) => d.id === athlete.division);
    if (!division) return null;
    const legKm = athlete.position.capKm;
    const next = division.checkpoints.find(
      (checkpoint) =>
        checkpoint.discipline === athlete.position.discipline && checkpoint.km >= legKm,
    );
    return next?.label ?? null;
  };

  return (
    <main className="mx-auto w-full max-w-[430px] pb-10">
      <PageHeader
        title="ブックマーク"
        subtitle={bibs.length > 0 ? `${bibs.length} 人` : null}
        race={race}
        lastPolledAt={lastPolledAt}
        error={raceError}
        intervalMs={intervalMs}
      />

      <div className="px-3 pt-2.5">
        <SearchBox onAdd={add} isAdded={has} />
      </div>

      <div className="px-3 pt-2.5 empty:hidden">
        <PreRaceNotice race={race} />
      </div>

      <div className="flex flex-col gap-2.5 px-3 pt-2.5">
        {!ready || (loading && athletes.length === 0) ? (
          <Skeleton className="h-40 w-full rounded-lg" />
        ) : null}

        {ready && bibs.length === 0 ? (
          <div className="rounded-lg border border-border border-dashed bg-card px-4 py-8 text-center">
            <p className="font-bold text-[14px]">応援する選手をブックマークしてください</p>
            <p className="mt-1.5 text-[12.5px] text-muted-foreground leading-relaxed">
              ゼッケン番号か名前で検索できます。追加するとこのブラウザに保存され、
              次に開いたときもそのまま残ります。
            </p>
            <Link
              href="/"
              className="mt-3 inline-block rounded font-bold text-[12.5px] text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
            >
              総合トップを見る ›
            </Link>
          </div>
        ) : null}

        {athletes.map((athlete) => (
          <AthleteCard
            key={athlete.bib}
            athlete={athlete}
            unread={items.some((item) => item.bib === athlete.bib && item.unread)}
            nextLabel={nextLabelOf(athlete)}
            checkpoints={barCheckpoints(divisionOf(athlete)?.checkpoints)}
            legKm={legKmOf(athlete)}
            onRemove={remove}
          />
        ))}

        {data?.missing.length ? (
          <p className="text-[12px] text-muted-foreground">
            ゼッケン {data.missing.join(", ")} は今年のエントリーに見つかりませんでした。
          </p>
        ) : null}
      </div>

      <div className="px-3 pt-3.5">
        <WeatherPanel weather={weather} />
      </div>
    </main>
  );
}
