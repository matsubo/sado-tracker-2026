"use client";

import { ListOrdered, Map, Star, Trophy } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const LINKS = [
  { href: "/", label: "総合", icon: Trophy, match: (path: string) => path === "/" },
  {
    href: "/friends",
    label: "友達",
    icon: Star,
    match: (path: string) => path.startsWith("/friends") || path.startsWith("/athletes"),
  },
  { href: "/map", label: "マップ", icon: Map, match: (path: string) => path.startsWith("/map") },
  {
    href: "/divisions/A",
    label: "種目別",
    icon: ListOrdered,
    match: (path: string) => path.startsWith("/divisions"),
  },
] as const;

/**
 * One bar on every page, so the reader always knows where they are and can
 * reach the other views in one tap. It sits at the bottom because that is
 * where a thumb rests, and the race is watched one-handed.
 */
export function GlobalNav() {
  const pathname = usePathname() ?? "/";

  return (
    <nav
      aria-label="メインメニュー"
      className="sticky bottom-0 z-30 border-border border-t bg-card/95 backdrop-blur"
    >
      <ul className="mx-auto flex max-w-[430px]">
        {LINKS.map((link) => {
          const active = link.match(pathname);
          const Icon = link.icon;
          return (
            <li key={link.href} className="flex-1">
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 font-semibold text-[10.5px] outline-none",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-[18px]" aria-hidden />
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** The wordmark, shown at the top of every page. */
export function GlobalHeader({ year }: { readonly year?: number }) {
  return (
    <div className="mx-auto flex w-full max-w-[430px] items-center justify-between px-4 pt-3 pb-1">
      <Link
        href="/"
        className="rounded font-bold text-[15px] tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        佐渡トラッカー
        <span className="ml-1.5 font-semibold text-[11.5px] text-muted-foreground">
          {year ?? 2026}
        </span>
      </Link>
      <Link
        href="https://systemway.jp/26sado?di=1"
        target="_blank"
        rel="noopener noreferrer"
        className="rounded text-[11px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        公式計測 ↗
      </Link>
    </div>
  );
}
