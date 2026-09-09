"use client";

import { useMemo } from "react";
import type { EventsResponseDto } from "@/lib/api/contract";
import { bibsFromEventsHref, eventsHref } from "@/lib/api/eventsLink";
import { useBookmarks } from "./useBookmarks";
import { type NotificationItem, useNotifications } from "./useNotifications";
import { useLiveResource, useRaceState } from "./useSnapshot";

export interface BookmarkNotifications {
  readonly items: readonly NotificationItem[];
  readonly unreadCount: number;
  readonly markAllSeen: () => void;
  readonly bookmarkCount: number;
}

/**
 * Checkpoint notifications for the bookmarked athletes, independent of which
 * page is open. The request is shared with anything else asking for the same
 * athletes, so putting the bell in the header costs no extra traffic.
 */
export function useBookmarkNotifications(): BookmarkNotifications {
  const { fetchedAt } = useRaceState();
  const { bibs, ready } = useBookmarks();

  const url = ready && bibs.length > 0 ? eventsHref(bibs) : null;
  const { data } = useLiveResource<EventsResponseDto>(url, fetchedAt);

  const events = useMemo(() => data?.events ?? [], [data]);

  // Who the passes above account for, taken from the answer that carried
  // them rather than from the bookmark list, so the two can never disagree
  // while a request for a just-added athlete is still in the air.
  const nobody = ready && bibs.length === 0;
  const covered = useMemo(() => {
    if (nobody) return [];
    // Nothing on the wire is checked against the schema, and this runs on
    // every page: an answer of an unexpected shape has to leave the bell
    // knowing nothing, not take the app down as it renders.
    const href = data?._links?.self?.href;
    return typeof href === "string" ? bibsFromEventsHref(href) : null;
  }, [nobody, data]);

  const { items, unreadCount, markAllSeen } = useNotifications(events, covered);

  return { items, unreadCount, markAllSeen, bookmarkCount: bibs.length };
}
