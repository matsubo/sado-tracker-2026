"use client";

import Link from "next/link";
import type { NotificationItem } from "@/hooks/useNotifications";
import { formatClockShort, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils/cn";

const CHIP: Record<string, string> = {
  swim: "bg-[color:var(--swim-bg)] text-[color:var(--swim)]",
  bike: "bg-[color:var(--bike-bg)] text-[color:var(--bike)]",
  run: "bg-[color:var(--run-bg)] text-[color:var(--run)]",
};

interface Props {
  readonly items: readonly NotificationItem[];
  readonly friendCount: number;
  readonly onMarkAllSeen: () => void;
}

/**
 * Checkpoint passes for the bookmarked athletes, newest first. Unread is
 * tracked in this browser by checkpoint, not by time, so a pass that the
 * timing site publishes late still shows up as new.
 */
export function NotificationPanel({ items, friendCount, onMarkAllSeen }: Props) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <header className="flex items-center justify-between border-border border-b px-3.5 py-3">
        <h2 className="font-bold text-[14px]">通知 · 友達 {friendCount} 人</h2>
        <button
          type="button"
          onClick={onMarkAllSeen}
          className="rounded font-bold text-[12px] text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        >
          すべて既読にする
        </button>
      </header>

      {items.length === 0 ? (
        <p className="px-3.5 py-6 text-center text-[12.5px] text-muted-foreground">
          友達がまだ計測点を通過していません。
        </p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.key} className="border-border border-b last:border-b-0">
              <Link
                href={`/athletes/${item.bib}`}
                className="grid grid-cols-[14px_44px_1fr] items-start gap-2 px-3.5 py-2.5 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2"
              >
                <span
                  className={cn(
                    "mt-1.5 h-2 w-2 rounded-full",
                    item.unread ? "bg-destructive" : "bg-transparent",
                  )}
                  aria-label={item.unread ? "未読" : undefined}
                />
                <span className="pt-px font-semibold text-[13px] text-muted-foreground tabular-nums">
                  {formatClockShort(item.passedAt)}
                </span>
                <span>
                  <span
                    className={cn(
                      "block font-bold text-[13.5px]",
                      !item.unread && "font-semibold text-muted-foreground",
                    )}
                  >
                    {item.name}{" "}
                    <span className="font-semibold text-[12px] text-muted-foreground tabular-nums">
                      #{item.bib}
                    </span>
                  </span>
                  <span className="block text-[12px] text-muted-foreground leading-snug tabular-nums">
                    <span
                      className={cn(
                        "mr-1 rounded px-1.5 py-px font-bold text-[11.5px]",
                        CHIP[item.discipline] ?? "bg-muted",
                      )}
                    >
                      {item.checkpointLabel}
                    </span>
                    通過 · 経過{" "}
                    <b className="font-semibold text-foreground">{formatDuration(item.elapsedMs)}</b>
                    {item.divisionRank ? (
                      <>
                        {" · 部門 "}
                        <b className="font-semibold text-foreground">{item.divisionRank.rank}</b>/
                        {item.divisionRank.of}
                      </>
                    ) : null}
                    {item.ageRank ? (
                      <>
                        {" · エイジ "}
                        <b className="font-semibold text-foreground">{item.ageRank.rank}</b>/
                        {item.ageRank.of}
                      </>
                    ) : null}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="bg-muted px-3.5 py-2.5 text-[11.5px] text-muted-foreground">
        既読はこのブラウザで管理します。計測サイトの反映が遅れて届いた通過も、未表示なら未読として出します。
      </p>
    </section>
  );
}
