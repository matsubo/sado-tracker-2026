"use client";

import { useEffect, useState } from "react";
import type { RaceStateDto } from "@/lib/api/contract";
import { formatClock } from "@/lib/format";
import { cn } from "@/lib/utils/cn";

const POLL_MS = 15_000;

/** Update time, freshness and a bar counting down to the next check. */
export function LiveStatusBar({
  race,
  lastPolledAt,
  error,
}: {
  readonly race: RaceStateDto | null;
  readonly lastPolledAt: number;
  readonly error: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const elapsed = Math.min(POLL_MS, Math.max(0, now - lastPolledAt));
  const secondsLeft = Math.ceil((POLL_MS - elapsed) / 1000);
  const stale = race?.stale === true || error !== null;

  return (
    <div>
      <div className="flex items-center justify-between px-4 pb-2 text-[11.5px] text-muted-foreground tabular-nums">
        <p>
          <span
            className={cn(
              "mr-1.5 inline-block h-[7px] w-[7px] rounded-full align-[1px]",
              stale ? "bg-[color:var(--bike)]" : "bg-[color:var(--good)]",
            )}
            aria-hidden
          />
          {race ? (
            <>
              最終更新 {formatClock(race.fetchedAt)}
              {stale ? "（再取得中）" : null}
              {race.replay ? " · リプレイ" : null}
            </>
          ) : (
            "レースデータを取得中です"
          )}
        </p>
        <p>{secondsLeft} 秒後に確認</p>
      </div>
      <div className="h-0.5 bg-border">
        <div
          className="h-full bg-primary transition-[width] duration-1000 ease-linear"
          style={{ width: `${(elapsed / POLL_MS) * 100}%` }}
        />
      </div>
    </div>
  );
}
