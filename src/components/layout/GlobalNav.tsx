"use client";

import { Bell, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { NAV_LINKS, OFFICIAL_URL } from "@/components/layout/navLinks";
import { NotificationPanel } from "@/components/tracker/NotificationPanel";
import { useBookmarkNotifications } from "@/hooks/useBookmarkNotifications";
import { cn } from "@/lib/utils/cn";

/**
 * The wordmark and the menu, on every page. The menu is a panel rather than a
 * fixed bar along the bottom: the bar covered the end of every page and had
 * to be scrolled past, which is worse than one tap to open a list.
 */
export function GlobalHeader({ year }: { readonly year?: number }) {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const panelId = useId();
  const bellId = useId();
  const container = useRef<HTMLDivElement>(null);
  const current = NAV_LINKS.find((link) => link.match(pathname));
  const { items, unreadCount, markAllSeen, bookmarkCount } = useBookmarkNotifications();

  // biome-ignore lint/correctness/useExhaustiveDependencies: navigating away is the trigger, not an input
  useEffect(() => {
    setOpen(false);
    setBellOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open && !bellOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) {
        setOpen(false);
        setBellOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setBellOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, bellOpen]);

  return (
    <div ref={container} className="relative mx-auto w-full max-w-[430px]">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <Link
          href="/"
          className="rounded font-bold text-[15px] tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          佐渡トラッカー
          <span className="ml-1.5 font-semibold text-[11.5px] text-muted-foreground">
            {year ?? 2026}
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setBellOpen((value) => {
                if (!value) markAllSeen();
                return !value;
              });
              setOpen(false);
            }}
            aria-expanded={bellOpen}
            aria-controls={bellId}
            aria-label={`通知${unreadCount > 0 ? ` ${unreadCount} 件の未読` : ""}`}
            className={cn(
              "relative grid size-8 place-items-center rounded-md border outline-none focus-visible:ring-2 focus-visible:ring-ring",
              bellOpen
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            <Bell className="size-[15px]" aria-hidden />
            {unreadCount > 0 ? (
              <span className="-top-1.5 -right-1.5 absolute grid h-[17px] min-w-[17px] place-items-center rounded-full bg-destructive px-1 font-bold text-[10.5px] text-destructive-foreground">
                {unreadCount}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => {
              setOpen((value) => !value);
              setBellOpen(false);
            }}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={
              open
                ? "メニューを閉じる"
                : `メニューを開く${current ? `（現在: ${current.label}）` : ""}`
            }
            className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 font-semibold text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {open ? (
              <X className="size-[15px]" aria-hidden />
            ) : (
              <Menu className="size-[15px]" aria-hidden />
            )}
            {/* The page title sits right below, so repeating it here is noise. */}
            <span className="text-muted-foreground">メニュー</span>
          </button>
        </div>
      </div>

      {bellOpen ? (
        <div id={bellId} className="absolute right-3 z-40 mt-1 w-[min(21rem,calc(100vw-1.5rem))]">
          <NotificationPanel
            items={items}
            friendCount={bookmarkCount}
            onMarkAllSeen={markAllSeen}
          />
        </div>
      ) : null}

      {open ? (
        <nav
          id={panelId}
          aria-label="メインメニュー"
          className="absolute right-3 z-40 mt-1 w-52 overflow-hidden rounded-lg border border-border bg-popover shadow-lg"
        >
          <ul>
            {NAV_LINKS.map((link) => {
              const active = link.match(pathname);
              const Icon = link.icon;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 px-3.5 py-2.5 font-semibold text-[13px] outline-none",
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                      active ? "bg-muted text-primary" : "text-foreground hover:bg-muted",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    {link.label}
                  </Link>
                </li>
              );
            })}
            <li className="border-border border-t">
              <a
                href={OFFICIAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 px-3.5 py-2.5 text-[12px] text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                公式計測サイト ↗
              </a>
            </li>
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
