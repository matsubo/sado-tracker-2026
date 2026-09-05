import type { ReactNode } from "react";
import { formatClock } from "@/lib/format";
import { cn } from "@/lib/utils/cn";

/** Default polling period, matching the live tracker's refresh loop. */
const DEFAULT_INTERVAL_MS = 60_000;

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  /** Epoch ms of the last successful fetch, or null before the first one. */
  updatedAt: number | null;
  /** True when the last fetch failed or the data is older than one interval. */
  stale: boolean;
  /** Milliseconds until the next refresh, or null when polling is idle. */
  nextInMs: number | null;
  /** Length of one refresh cycle; drives the progress bar. */
  intervalMs?: number;
  className?: string;
};

/** Clamps a ratio into the 0..1 range, collapsing non-finite input to 0. */
const clampRatio = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
};

/** Fraction of the current refresh interval that has already elapsed. */
const elapsedFraction = (nextInMs: number | null, intervalMs: number): number => {
  if (nextInMs === null || intervalMs <= 0) return 0;
  return clampRatio(1 - nextInMs / intervalMs);
};

/** Whole seconds remaining until the next refresh, never negative. */
const secondsUntil = (nextInMs: number): number => Math.max(0, Math.ceil(nextInMs / 1000));

/**
 * Sticky page header: title, action slot, refresh status and a progress bar
 * that fills as the next poll approaches.
 */
export function AppHeader({
  title,
  subtitle,
  right,
  updatedAt,
  stale,
  nextInMs,
  intervalMs = DEFAULT_INTERVAL_MS,
  className,
}: AppHeaderProps) {
  const progress = elapsedFraction(nextInMs, intervalMs);

  return (
    <header className={cn("sticky top-0 z-30 border-border border-b bg-card", className)}>
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate font-bold text-xl leading-none tracking-tight">{title}</span>
          {subtitle ? (
            <span className="shrink-0 font-semibold text-[13px] text-muted-foreground tracking-wider">
              {subtitle}
            </span>
          ) : null}
        </div>
        {right ? <div className="flex shrink-0 items-center gap-2.5">{right}</div> : null}
      </div>

      <div className="flex items-center justify-between gap-2 px-4 pb-2 text-[11.5px] text-muted-foreground tabular-nums">
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden="true"
            data-stale={stale}
            className={cn(
              "size-[7px] shrink-0 rounded-full",
              stale ? "bg-amber-500" : "bg-[color:var(--good)]",
            )}
          />
          <span className="truncate">
            {updatedAt === null ? "更新待ち" : `最終更新 ${formatClock(updatedAt)}`}
            {stale ? "（再取得中）" : ""}
          </span>
        </span>
        {nextInMs === null ? null : (
          <span className="shrink-0">{`${secondsUntil(nextInMs)} 秒後に更新`}</span>
        )}
      </div>

      <div aria-hidden="true" className="h-0.5 w-full bg-border">
        <div
          className="h-full bg-primary transition-[width] duration-500 ease-linear"
          style={{ width: `${(progress * 100).toFixed(1)}%` }}
        />
      </div>
    </header>
  );
}

export type { AppHeaderProps };
