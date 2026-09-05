"use client";

import type { PositionDto } from "@/lib/api/contract";
import { formatKm } from "@/lib/format";
import { projectKm, useLiveClock } from "@/hooks/useLivePosition";
import { cn } from "@/lib/utils/cn";

/** Widths chosen so each leg is legible, not to scale with distance. */
const SEGMENT_WIDTH: Record<string, string> = {
  swim: "22%",
  bike: "48%",
  run: "30%",
};

const ORDER = ["swim", "bike", "run"] as const;

const FILL: Record<string, string> = {
  swim: "bg-[color:var(--swim)]",
  bike: "bg-[color:var(--bike)]",
  run: "bg-[color:var(--run)]",
};

const LABELS: Record<string, string> = { swim: "スイム", bike: "バイク", run: "ラン" };

interface Props {
  readonly position: PositionDto;
  readonly finished: boolean;
  readonly nextLabel?: string | null;
}

/**
 * The three legs as one bar. Legs before the current one are full, the current
 * one fills to the estimated position, and a marker sits at that point:
 * hollow while the position is projected, solid once a timing point confirms it.
 */
export function PositionBar({ position, finished, nextLabel }: Props) {
  const now = useLiveClock();
  const liveKm = finished ? position.totalKm : projectKm(position, now);
  const currentIndex = ORDER.indexOf(position.discipline);
  const fraction = position.totalKm > 0 ? Math.min(1, liveKm / position.totalKm) : 0;

  return (
    <div>
      <div className="flex gap-[3px]">
        {ORDER.map((leg, index) => {
          const done = finished || index < currentIndex;
          const active = !finished && index === currentIndex;
          const width = done ? "100%" : active ? `${fraction * 100}%` : "0%";
          return (
            <div
              key={leg}
              className="relative h-2.5 rounded-full bg-muted"
              style={{ flex: leg === "bike" ? "1 1 0%" : `0 0 ${SEGMENT_WIDTH[leg]}` }}
            >
              <div className={cn("absolute inset-y-0 left-0 rounded-full", FILL[leg])} style={{ width }} />
              {active ? (
                <span
                  className={cn(
                    "absolute top-[-4px] h-[18px] w-[18px] -translate-x-1/2 rounded-full border-[3px] bg-card border-foreground",
                    position.waiting ? "border-solid" : "border-dashed",
                  )}
                  style={{ left: width }}
                  aria-hidden
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="mt-1 flex justify-between gap-2 text-[11px] text-muted-foreground tabular-nums">
        <span>
          {finished ? (
            "フィニッシュ"
          ) : (
            <>
              {LABELS[position.discipline]}{" "}
              <span className="font-semibold text-foreground">
                約 {formatKm(liveKm, position.discipline === "bike" ? 0 : 1)} /{" "}
                {formatKm(position.totalKm, position.discipline === "bike" ? 0 : 1)}
              </span>
              （推定）
            </>
          )}
        </span>
        {nextLabel && !finished ? <span>次: {nextLabel}</span> : null}
      </p>
    </div>
  );
}
