"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SITE_NAME, storageKey } from "@/config/site";
import type { PassEventDto } from "@/lib/api/contract";

const STORAGE_KEY = storageKey("seen");

export interface NotificationItem {
  readonly key: string;
  readonly bib: string;
  readonly name: string;
  readonly checkpointLabel: string;
  readonly discipline: string;
  readonly passedAt: number;
  readonly elapsedMs: number;
  readonly divisionRank: { rank: number; of: number } | null;
  readonly ageRank: { rank: number; of: number } | null;
  readonly unread: boolean;
}

function readSeen(): Set<string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return new Set(
      Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [],
    );
  } catch {
    return new Set();
  }
}

/**
 * Turn the friends' checkpoint passes into a notification list. Every pass
 * is its own item, and unread is decided by a set of keys already shown, not
 * by a timestamp, so a checkpoint the timing site publishes late is still
 * announced even though an athlete has since passed a later one.
 */
export function useNotifications(events: readonly PassEventDto[]): {
  items: NotificationItem[];
  unreadCount: number;
  markAllSeen: () => void;
  ready: boolean;
} {
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSeen(readSeen());
    setReady(true);
  }, []);

  const items = useMemo(
    () =>
      events
        .map((event) => ({
          key: event.key,
          bib: event.bib,
          name: event.name,
          checkpointLabel: event.checkpointLabel,
          discipline: event.discipline,
          passedAt: event.passedAt,
          elapsedMs: event.elapsedMs,
          divisionRank: event.divisionRank,
          ageRank: event.ageRank,
          unread: ready && !seen.has(event.key),
        }))
        .sort((a, b) => b.passedAt - a.passedAt),
    [events, seen, ready],
  );

  const unreadCount = items.filter((item) => item.unread).length;

  const markAllSeen = useCallback(() => {
    setSeen((current) => {
      const next = new Set(current);
      for (const item of items) next.add(item.key);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // Storage is optional; the badge simply comes back next visit.
      }
      return next;
    });
  }, [items]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const base = SITE_NAME;
    document.title = unreadCount > 0 ? `(${unreadCount}) ${base}` : base;
  }, [unreadCount]);

  return { items, unreadCount, markAllSeen, ready };
}
