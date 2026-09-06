import { CircleHelp, ListOrdered, Map as MapIcon, Star, Trophy } from "lucide-react";

export interface NavLink {
  readonly href: string;
  readonly label: string;
  readonly icon: typeof Trophy;
  /** True when this link names the page currently open. */
  readonly match: (path: string) => boolean;
}

/**
 * The main destinations, in one place because the menu and the footer both
 * list them and a reader who finds different sets in the two has been told
 * the site is smaller than it is.
 */
export const NAV_LINKS: readonly NavLink[] = [
  { href: "/", label: "総合トップ", icon: Trophy, match: (path) => path === "/" },
  {
    href: "/bookmarks",
    label: "ブックマーク",
    icon: Star,
    match: (path) => path.startsWith("/bookmarks") || path.startsWith("/athletes"),
  },
  { href: "/map", label: "全体マップ", icon: MapIcon, match: (path) => path.startsWith("/map") },
  {
    href: "/divisions/A",
    label: "種目別順位",
    icon: ListOrdered,
    match: (path) => path.startsWith("/divisions"),
  },
  { href: "/help", label: "ヘルプ", icon: CircleHelp, match: (path) => path.startsWith("/help") },
];

/** The official timing site, listed last wherever the destinations appear. */
export const OFFICIAL_URL = "https://systemway.jp/26sado?di=1";

/**
 * The two pages a reader goes looking for rather than browses to. They are
 * deliberately not in NAV_LINKS: that list is the menu as well, and the menu
 * is for getting back to the race.
 */
export const LEGAL_LINKS: readonly { readonly href: string; readonly label: string }[] = [
  { href: "/terms", label: "利用規約" },
  { href: "/privacy", label: "プライバシーポリシー" },
];

/** Where a reader asks something, or asks to be taken off the site. */
export const CONTACT_URL = "https://discord.gg/FRzmgpCySV";
