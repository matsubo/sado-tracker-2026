"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";

const STORAGE_KEY = "sado2026.bookmarks";
const MAX_BOOKMARKS = 50;

/** Used when a caller does not name the screen the action came from. */
const UNKNOWN_SOURCE = "unknown";

function readStorage(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function readUrl(): string[] {
  const value = new URLSearchParams(window.location.search).get("bibs");
  return value
    ? value
        .split(",")
        .map((bib) => bib.trim())
        .filter(Boolean)
    : [];
}

/**
 * Bookmarked bibs live in this browser. A list can still be handed over by
 * opening a `?bibs=` link, which is how an athlete page or an external link
 * can seed one, but the app does not offer to publish anyone's list: who a
 * person is following is theirs. Nothing is stored on the server.
 */
export function useBookmarks(): {
  bibs: string[];
  ready: boolean;
  /** `source` records which screen the action came from, never who took it. */
  add: (bib: string, source?: string) => void;
  remove: (bib: string, source?: string) => void;
  has: (bib: string) => boolean;
} {
  const [bibs, setBibs] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  // The list as it stands right now. State alone cannot answer "did this
  // change anything?" during the same tick, and that answer decides whether
  // an event is worth reporting.
  const latest = useRef<string[]>([]);

  useEffect(() => {
    const fromUrl = readUrl();
    const merged =
      fromUrl.length > 0 ? [...new Set([...fromUrl, ...readStorage()])] : readStorage();
    const initial = merged.slice(0, MAX_BOOKMARKS);
    latest.current = initial;
    setBibs(initial);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bibs));
    } catch {
      // A browser with storage disabled still works, it just forgets.
    }
    // Keep the address bar clean: the list is remembered by this browser, and
    // putting it in the URL invites sharing something private by accident.
    const url = new URL(window.location.href);
    if (url.searchParams.has("bibs")) {
      url.searchParams.delete("bibs");
      window.history.replaceState(null, "", url.toString());
    }
  }, [bibs, ready]);

  // Reporting happens here rather than inside the state updater: React runs an
  // updater more than once in development, which would double every count.
  const add = useCallback((bib: string, source: string = UNKNOWN_SOURCE) => {
    const current = latest.current;
    if (current.includes(bib) || current.length >= MAX_BOOKMARKS) return;
    const next = [...current, bib];
    latest.current = next;
    setBibs(next);
    track("bookmark_add", { source });
  }, []);

  const remove = useCallback((bib: string, source: string = UNKNOWN_SOURCE) => {
    const current = latest.current;
    if (!current.includes(bib)) return;
    const next = current.filter((value) => value !== bib);
    latest.current = next;
    setBibs(next);
    track("bookmark_remove", { source });
  }, []);

  return { bibs, ready, add, remove, has: (bib) => bibs.includes(bib) };
}
