"use client";

import { useMemo } from "react";
import type { AthleteSummaryDto } from "@/lib/api/contract";
import { useBookmarks } from "./useBookmarks";
import { useNotifications } from "./useNotifications";
import { useLiveResource, useRaceState } from "./useSnapshot";

interface AthletesResponse {
  readonly athletes: readonly AthleteSummaryDto[];
  readonly missing: readonly string[];
}

/**
 * Checkpoint notifications for the bookmarked athletes, independent of which
 * page is open. The request is shared with anything else asking for the same
 * athletes, so putting the bell in the header costs no extra traffic.
 */
export function useBookmarkNotifications() {
  const { fetchedAt } = useRaceState();
  const { bibs, ready } = useBookmarks();

  const url = ready && bibs.length > 0 ? `/api/athletes?bibs=${bibs.join(",")}` : null;
  const { data } = useLiveResource<AthletesResponse>(url, fetchedAt);

  const athletes = useMemo(() => data?.athletes ?? [], [data]);
  const { items, unreadCount, markAllSeen } = useNotifications(athletes);

  return { items, unreadCount, markAllSeen, bookmarkCount: bibs.length };
}
