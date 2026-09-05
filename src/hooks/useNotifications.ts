"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AthleteSummaryDto } from "@/lib/api/contract";

const STORAGE_KEY = "sado2026.seen";

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
 * Turn the friends' checkpoint history into a notification list. Unread is
 * decided by a set of keys already shown, not by a timestamp, so a checkpoint
 * that the timing site publishes late is still announced.
 */
export function useNotifications(athletes: readonly AthleteSummaryDto[]): {
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

  const items = useMemo(() => {
    const list: NotificationItem[] = [];
    for (const athlete of athletes) {
      if (athlete.lastPassedAt === null || athlete.lastCheckpointLabel === null) continue;
      const key = `${athlete.bib}:${athlete.lastCheckpointLabel}`;
      list.push({
        key,
        bib: athlete.bib,
        name: athlete.name,
        checkpointLabel: athlete.lastCheckpointLabel,
        discipline: athlete.position.discipline,
        passedAt: athlete.lastPassedAt,
        elapsedMs: athlete.elapsedMs ?? 0,
        divisionRank: athlete.totalRanks.division,
        ageRank: athlete.totalRanks.ageGroup,
        unread: ready && !seen.has(key),
      });
    }
    return list.sort((a, b) => b.passedAt - a.passedAt);
  }, [athletes, seen, ready]);

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
    const base = "佐渡トラッカー 2026";
    document.title = unreadCount > 0 ? `(${unreadCount}) ${base}` : base;
  }, [unreadCount]);

  return { items, unreadCount, markAllSeen, ready };
}
