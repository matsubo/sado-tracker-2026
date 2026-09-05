"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import type { RaceStateDto } from "@/lib/api/contract";
import { formatClock, formatClockShort } from "@/lib/format";
import { raceNow } from "@/lib/runtime/raceClock";
import { cn } from "@/lib/utils/cn";

interface LiveStatusBarProps {
  readonly race: RaceStateDto | null;
  readonly lastPolledAt: number;
  readonly error: string | null;
  readonly intervalMs?: number;
  /** Whether the page is refreshing itself. */
  readonly auto?: boolean;
  readonly onAutoChange?: (value: boolean) => void;
  readonly onRefresh?: () => void;
}

/**
 * One line: what time it is in the race, when the data was last read, and a
 * control for how it refreshes.
 *
 * There is no progress bar. A bar that fills every fifteen seconds draws the
 * eye away from the numbers it sits above, and the update time already says
 * everything a reader needs about freshness.
 */
export function LiveStatusBar({
  race,
  lastPolledAt,
  error,
  intervalMs = 15_000,
  auto = true,
  onAutoChange,
  onRefresh,
}: LiveStatusBarProps) {
  const [now, setNow] = useState(lastPolledAt);
  const [raceTime, setRaceTime] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      setNow(Date.now());
      setRaceTime(raceNow());
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  const stale = race?.stale === true || error !== null;
  const sinceSeconds = Math.max(0, Math.round((now - lastPolledAt) / 1000));
  const secondsLeft = Math.max(0, Math.ceil((intervalMs - (now - lastPolledAt)) / 1000));

  return (
    <div className="mx-auto flex w-full max-w-[430px] items-baseline justify-between gap-2 border-border border-b px-4 pb-1.5 text-[11.5px] text-muted-foreground tabular-nums">
      <p className="min-w-0 truncate">
        <span
          className={cn(
            "mr-1.5 inline-block h-[7px] w-[7px] rounded-full align-[1px]",
            stale ? "bg-[color:var(--warn)]" : "bg-[color:var(--good)]",
          )}
          aria-hidden
        />
        {race ? (
          <>
            <span className="font-semibold text-[13px] text-foreground">
              {formatClockShort(raceTime ?? race.now)}
            </span>
            {race.replay ? (
              <span className="ml-1 rounded bg-muted px-1 py-px text-[10px]">リプレイ</span>
            ) : null}
            <span className="ml-1.5">
              現在 · 更新 {formatClock(race.fetchedAt)}
              {stale ? "（再取得中）" : null}
            </span>
          </>
        ) : (
          "レースデータを取得中です"
        )}
      </p>

      <span className="flex shrink-0 items-center gap-2">
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            aria-label="いま更新する"
            className="flex items-center gap-1 rounded px-1 py-0.5 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RefreshCw className="size-[11px]" aria-hidden />
            {auto ? `${secondsLeft}秒` : `${sinceSeconds}秒前`}
          </button>
        ) : null}
        {onAutoChange ? (
          <label className="flex cursor-pointer items-center gap-1 select-none">
            <input
              type="checkbox"
              checked={auto}
              onChange={(event) => onAutoChange(event.target.checked)}
              className="size-3 accent-[color:var(--primary)]"
            />
            自動更新
          </label>
        ) : null}
      </span>
    </div>
  );
}
