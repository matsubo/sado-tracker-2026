"use client";

import { Bell, Share2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useNotifications } from "@/hooks/useNotifications";
import { useLiveResource, useRaceState } from "@/hooks/useSnapshot";
import type { AthleteSummaryDto } from "@/lib/api/contract";
import type { WeatherData } from "@/lib/weather/types";
import { cn } from "@/lib/utils/cn";
import { AthleteCard } from "./AthleteCard";
import { LiveStatusBar } from "./LiveStatusBar";
import { NotificationPanel } from "./NotificationPanel";
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
  const { race, fetchedAt, error: raceError, lastPolledAt } = useRaceState();
  const { bibs, ready, add, remove, has, shareUrl } = useBookmarks();
  const [panelOpen, setPanelOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const athletesUrl = ready && bibs.length > 0 ? `/api/athletes?bibs=${bibs.join(",")}` : null;
  const { data, loading } = useLiveResource<AthletesResponse>(athletesUrl, fetchedAt);
  const { data: weather } = useLiveResource<WeatherData>("/api/weather", null);

  const athletes = useMemo(() => data?.athletes ?? [], [data]);
  const { items, unreadCount, markAllSeen } = useNotifications(athletes);

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

  const share = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-[430px] pb-10">
      <header className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <h1 className="font-bold text-[20px] tracking-tight">
          佐渡トラッカー
          <span className="ml-1.5 font-semibold text-[13px] text-muted-foreground">
            {race?.year ?? 2026}
          </span>
        </h1>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => void share()}
            aria-label="友達リストのリンクをコピー"
            className="relative grid h-9 w-9 place-items-center rounded-lg border border-border bg-muted text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
          >
            <Share2 className="h-4 w-4" />
          </button>
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

      <LiveStatusBar race={race} lastPolledAt={lastPolledAt} error={raceError} />

      {copied ? (
        <p className="mx-3 mt-2 rounded-lg bg-foreground px-3 py-2 text-[12.5px] text-background">
          リンクをコピーしました。この URL を送ると同じ友達リストが開きます。
        </p>
      ) : null}

      <div className="px-3 pt-2.5">
        <SearchBox onAdd={add} isAdded={has} />
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
              右上の共有ボタンで同じリストを他の人に送れます。
            </p>
            <Link
              href="/map"
              className="mt-3 inline-block rounded font-bold text-[12.5px] text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
            >
              全体マップを見る ›
            </Link>
          </div>
        ) : null}

        {athletes.map((athlete) => (
          <AthleteCard
            key={athlete.bib}
            athlete={athlete}
            unread={items.some((item) => item.bib === athlete.bib && item.unread)}
            nextLabel={nextLabelOf(athlete)}
            onRemove={remove}
          />
        ))}

        {data?.missing.length ? (
          <p className="text-[12px] text-muted-foreground">
            ゼッケン {data.missing.join(", ")} は今年のエントリーに見つかりませんでした。
          </p>
        ) : null}
      </div>

      <nav className="flex gap-2 px-3 pt-3.5">
        <Link
          href="/map"
          className="flex-1 rounded-lg border border-border bg-card py-2 text-center font-bold text-[12.5px] focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        >
          全体マップ
        </Link>
        <Link
          href="/divisions/A"
          className="flex-1 rounded-lg border border-border bg-card py-2 text-center font-bold text-[12.5px] focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        >
          部門別ランキング
        </Link>
      </nav>

      <div className="px-3 pt-3.5">
        <WeatherPanel weather={weather} />
      </div>
    </main>
  );
}
