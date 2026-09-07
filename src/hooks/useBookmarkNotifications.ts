"use client";

import { useMemo } from "react";
import type { EventsResponseDto } from "@/lib/api/contract";
import { useBookmarks } from "./useBookmarks";
import { useNotifications } from "./useNotifications";
import { useLiveResource, useRaceState } from "./useSnapshot";

/**
 * Checkpoint notifications for the bookmarked athletes, independent of which
 * page is open. The request is shared with anything else asking for the same
 * athletes, so putting the bell in the header costs no extra traffic.
 */
export function useBookmarkNotifications() {
  const { fetchedAt } = useRaceState();
  const { bibs, ready } = useBookmarks();

  const url =
    ready && bibs.length > 0 ? `/api/events?bibs=${encodeURIComponent(bibs.join(","))}` : null;
  const { data } = useLiveResource<EventsResponseDto>(url, fetchedAt);

  const events = useMemo(() => data?.events ?? [], [data]);
  const { items, unreadCount, markAllSeen } = useNotifications(events);

  return { items, unreadCount, markAllSeen, bookmarkCount: bibs.length };
}
