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
