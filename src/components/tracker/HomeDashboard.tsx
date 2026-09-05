"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { GlobalHeader } from "@/components/layout/GlobalNav";
import { Skeleton } from "@/components/ui/skeleton";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useNotifications } from "@/hooks/useNotifications";
import { useLiveResource, useRaceState } from "@/hooks/useSnapshot";
import type { AthleteSummaryDto } from "@/lib/api/contract";
import { cn } from "@/lib/utils/cn";
import type { WeatherData } from "@/lib/weather/types";
import { AthleteCard } from "./AthleteCard";
import { LiveStatusBar } from "./LiveStatusBar";
import { NotificationPanel } from "./NotificationPanel";
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
export function HomeDashboard() {
  const { race, fetchedAt, error: raceError, lastPolledAt, intervalMs } = useRaceState();
  const { bibs, ready, add, remove, has } = useBookmarks();
  const [panelOpen, setPanelOpen] = useState(false);

  const athletesUrl = ready && bibs.length > 0 ? `/api/athletes?bibs=${bibs.join(",")}` : null;
  const { data, loading } = useLiveResource<AthletesResponse>(athletesUrl, fetchedAt);
  const { data: weather } = useLiveResource<WeatherData>("/api/weather", null);

  const athletes = useMemo(() => data?.athletes ?? [], [data]);
  const { items, unreadCount, markAllSeen } = useNotifications(athletes);

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
      <GlobalHeader year={race?.year} />
      <header className="flex items-center justify-between px-4 pt-1 pb-2">
        <h1 className="font-bold text-[20px] tracking-tight">友達一覧</h1>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setPanelOpen((open) => !open);
              if (!panelOpen) markAllSeen();
            }}
            aria-label={`通知${unreadCount > 0 ? ` ${unreadCount} 件の未読` : ""}`}
            aria-expanded={panelOpen}
            className={cn(
              "relative grid h-9 w-9 place-items-center rounded-lg border focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
              panelOpen
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-muted text-muted-foreground",
            )}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 ? (
              <span className="-top-1.5 -right-1.5 absolute grid h-[18px] min-w-[18px] place-items-center rounded-full bg-destructive px-1 font-bold text-[11px] text-destructive-foreground">
                {unreadCount}
              </span>
            ) : null}
          </button>
        </div>
      </header>

      <LiveStatusBar
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

      {panelOpen ? (
        <div className="px-3 pt-2.5">
          <NotificationPanel items={items} friendCount={bibs.length} onMarkAllSeen={markAllSeen} />
        </div>
      ) : null}

      <div className="flex flex-col gap-2.5 px-3 pt-2.5">
        {!ready || (loading && athletes.length === 0) ? (
          <Skeleton className="h-40 w-full rounded-lg" />
        ) : null}

        {ready && bibs.length === 0 ? (
          <div className="rounded-lg border border-border border-dashed bg-card px-4 py-8 text-center">
            <p className="font-bold text-[14px]">応援する友達を追加してください</p>
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
