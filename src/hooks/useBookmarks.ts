"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "sado2026.bookmarks";
const MAX_BOOKMARKS = 50;

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
  add: (bib: string) => void;
  remove: (bib: string) => void;
  has: (bib: string) => boolean;
} {
  const [bibs, setBibs] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const fromUrl = readUrl();
    const merged =
      fromUrl.length > 0 ? [...new Set([...fromUrl, ...readStorage()])] : readStorage();
    setBibs(merged.slice(0, MAX_BOOKMARKS));
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

  const add = useCallback((bib: string) => {
    setBibs((current) =>
      current.includes(bib) ? current : [...current, bib].slice(0, MAX_BOOKMARKS),
    );
  }, []);

  const remove = useCallback((bib: string) => {
    setBibs((current) => current.filter((value) => value !== bib));
  }, []);

  return { bibs, ready, add, remove, has: (bib) => bibs.includes(bib) };
}
