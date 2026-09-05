"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { GlobalHeader } from "@/components/layout/GlobalNav";
import { LiveStatusBar } from "@/components/tracker/LiveStatusBar";
import type { RaceStateDto } from "@/lib/api/contract";

interface PageHeaderProps {
  readonly title: string;
  /** Shown next to the title in a lighter weight, e.g. the division. */
  readonly subtitle?: string | null;
  /** A link back to the page this one was reached from. */
  readonly back?: { readonly href: string; readonly label: string } | null;
  /** A control belonging to this page, placed opposite the title. */
  readonly action?: ReactNode;
  readonly race: RaceStateDto | null;
  readonly lastPolledAt: number;
  readonly error: string | null;
  readonly intervalMs?: number;
  readonly auto?: boolean;
  readonly onAutoChange?: (value: boolean) => void;
  readonly onRefresh?: () => void;
}

/**
 * The same three rows at the top of every page, in the same order:
 *
 * 1. where you are in the app (wordmark, notifications, menu)
 * 2. what this page is (title, and any control that belongs to it)
 * 3. how fresh what you are reading is (race clock and refresh state)
 *
 * Pages used to assemble these themselves and drifted apart, with two of
 * them showing the title above the clock and three below it.
 */
export function PageHeader({
  title,
  subtitle,
  back,
  action,
  race,
  lastPolledAt,
  error,
  intervalMs,
  auto,
  onAutoChange,
  onRefresh,
}: PageHeaderProps) {
  return (
    <header>
      <GlobalHeader year={race?.year} />

      <div className="mx-auto flex w-full max-w-[430px] items-end justify-between gap-2 px-4 pt-0.5 pb-1.5">
        <div className="min-w-0">
          {back ? (
            <Link
              href={back.href}
              className="block rounded text-[11.5px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              ‹ {back.label}
            </Link>
          ) : null}
          <h1 className="truncate font-bold text-[19px] tracking-tight">
            {title}
            {subtitle ? (
              <span className="ml-2 font-semibold text-[12px] text-muted-foreground">
                {subtitle}
              </span>
            ) : null}
          </h1>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      <LiveStatusBar
        race={race}
        lastPolledAt={lastPolledAt}
        error={error}
        intervalMs={intervalMs}
        auto={auto}
        onAutoChange={onAutoChange}
        onRefresh={onRefresh}
      />
    </header>
  );
}
