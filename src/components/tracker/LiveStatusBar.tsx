"use client";

import { useEffect, useState } from "react";
import type { RaceStateDto } from "@/lib/api/contract";
import { formatClock, formatClockShort } from "@/lib/format";
import { raceNow } from "@/lib/runtime/raceClock";
import { cn } from "@/lib/utils/cn";

/** Update time, freshness and a bar counting down to the next check. */
export function LiveStatusBar({
  race,
  lastPolledAt,
  error,
  intervalMs = 15_000,
}: {
  readonly race: RaceStateDto | null;
  readonly lastPolledAt: number;
  readonly error: string | null;
  readonly intervalMs?: number;
}) {
  // The countdown depends on the wall clock, which differs between the render
  // on the server and the one in the browser. Starting from the poll time and
  // only ticking after mount keeps the two markups identical.
  const [now, setNow] = useState(lastPolledAt);
  // Race time, which differs from the device clock in replay.
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

  const elapsed = Math.min(intervalMs, Math.max(0, now - lastPolledAt));
  const secondsLeft = Math.ceil((intervalMs - elapsed) / 1000);
  const stale = race?.stale === true || error !== null;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 px-4 pb-2 text-[11.5px] text-muted-foreground tabular-nums">
        <p className="min-w-0">
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
                現在 · 最終更新 {formatClock(race.fetchedAt)}
                {stale ? "（再取得中）" : null}
              </span>
            </>
          ) : (
            "レースデータを取得中です"
          )}
        </p>
        <p className="shrink-0">{secondsLeft} 秒後に確認</p>
      </div>
      <div className="h-0.5 bg-border">
        <div
          className="h-full bg-primary transition-[width] duration-1000 ease-linear"
          style={{ width: `${(elapsed / intervalMs) * 100}%` }}
        />
      </div>
    </div>
  );
}
