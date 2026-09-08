"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { storageKey } from "@/config/site";
import type { PassEventDto } from "@/lib/api/contract";

const SEEN_KEY = storageKey("seen");
/** The athletes whose race so far has already been folded into the list. */
const CAUGHT_UP_KEY = storageKey("caughtUp");

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

function readKeys(key: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return new Set(
      Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [],
    );
  } catch {
    return new Set();
  }
}

function writeKeys(key: string, keys: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(key, JSON.stringify([...keys]));
  } catch {
    // Storage is optional; the badge simply comes back next visit.
  }
}

/**
 * Turn the friends' checkpoint passes into a notification list. Every pass
 * is its own item, and unread is decided by a set of keys already shown, not
 * by a timestamp, so a checkpoint the timing site publishes late is still
 * announced even though an athlete has since passed a later one.
 *
 * Bookmarking someone mid-race is the one thing that does not raise the
 * badge: everything they had already done arrives in a single answer, and a
 * race that was run before anyone was following it is not news. Those passes
 * are listed, read; the next one they make is new.
 *
 * `covered` says which athletes the passes account for and has to be read
 * from the same answer as `events`, never from the bookmark list: an answer
 * for the previous list is silent about an athlete just added, and taking
 * that silence for "has not started yet" would announce their whole race.
 * Null while that is unknown.
 */
export function useNotifications(
  events: readonly PassEventDto[],
  covered: readonly string[] | null,
): {
  items: NotificationItem[];
  unreadCount: number;
  markAllSeen: () => void;
  ready: boolean;
} {
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [caughtUp, setCaughtUp] = useState<Set<string>>(() => new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSeen(readKeys(SEEN_KEY));
    setCaughtUp(readKeys(CAUGHT_UP_KEY));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || covered === null) return;
    // Athletes, not names: a list that repeats a bib would never look caught
    // up, and this would settle nothing and run again on every render.
    const wanted = new Set(covered);
    const fresh = [...wanted].filter((bib) => !caughtUp.has(bib));
    // Athletes no longer followed are forgotten, so that bookmarking one of
    // them again treats the race they ran meanwhile as history once more.
    if (fresh.length === 0 && caughtUp.size === wanted.size) return;

    if (fresh.length > 0) {
      const bibs = new Set(fresh);
      const nextSeen = new Set(seen);
      for (const event of events) if (bibs.has(event.bib)) nextSeen.add(event.key);
      writeKeys(SEEN_KEY, nextSeen);
      setSeen(nextSeen);
    }
    writeKeys(CAUGHT_UP_KEY, wanted);
    setCaughtUp(wanted);
  }, [ready, covered, events, seen, caughtUp]);

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
          unread: ready && caughtUp.has(event.bib) && !seen.has(event.key),
        }))
        .sort((a, b) => b.passedAt - a.passedAt),
    [events, seen, caughtUp, ready],
  );

  const unreadCount = items.filter((item) => item.unread).length;

  const markAllSeen = useCallback(() => {
    setSeen((current) => {
      const next = new Set(current);
      for (const item of items) next.add(item.key);
      writeKeys(SEEN_KEY, next);
      return next;
    });
  }, [items]);

  return { items, unreadCount, markAllSeen, ready };
}
