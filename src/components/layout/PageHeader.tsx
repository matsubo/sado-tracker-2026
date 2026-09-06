"use client";

import Link from "next/link";
import { type ReactNode, useEffect } from "react";
import { GlobalHeader } from "@/components/layout/GlobalNav";
import { LiveStatusBar } from "@/components/tracker/LiveStatusBar";
import type { RaceStateDto } from "@/lib/api/contract";
import { pageTitle, setPageName } from "@/lib/pageTitle";

interface PageHeaderProps {
  readonly title: string;
  /** Shown next to the title in a lighter weight, e.g. the division. */
  readonly subtitle?: string | null;
  /**
   * What the browser tab and analytics call this page, when the heading is
   * not enough on its own. It has to stay the same as long as the page does:
   * a subtitle that counts bookmarks would file one screen under a different
   * name for every reader.
   */
  readonly documentTitle?: string;
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
  documentTitle,
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
  // Next updates the description on a client-side navigation but leaves the
  // title on whatever the root layout set, so every screen reported itself as
  // the front page. Analytics reads document.title when it sends a page view,
  // and this effect runs before the layout's, so the name is right by then.
  const name = documentTitle ?? title;
  // Recorded during render so the page-view effect, which runs afterwards,
  // never reports the screen the reader just left.
  setPageName(name);
  useEffect(() => {
    const wanted = pageTitle(name);
    document.title = wanted;

    // The framework re-applies the root layout's title after this effect on
    // some routes, which leaves the tab, and anything reading it, naming the
    // page the reader has left. Writing the same value causes no mutation, so
    // this settles after one correction rather than looping.
    const titleTag = document.querySelector("title");
    if (!titleTag) return;
    const observer = new MutationObserver(() => {
      if (document.title !== wanted) document.title = wanted;
    });
    observer.observe(titleTag, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, [name]);

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
