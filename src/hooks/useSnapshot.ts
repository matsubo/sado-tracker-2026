"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RaceStateDto } from "@/lib/api/contract";
import { setRaceClockOffset } from "@/lib/runtime/raceClock";

const DEFAULT_POLL_MS = 15_000;
const MIN_POLL_MS = 1_000;

/**
 * Check at least as often as the server recomputes, so a fast replay is not
 * watched through a fifteen-second window. Never faster than once a second.
 */
function clientPollMs(serverIntervalMs: number | undefined): number {
  if (serverIntervalMs === undefined) return DEFAULT_POLL_MS;
  return Math.max(MIN_POLL_MS, Math.min(DEFAULT_POLL_MS, serverIntervalMs));
}

const AUTO_KEY = "sado2026.autoRefresh";

function readAuto(): boolean {
  try {
    return window.localStorage.getItem(AUTO_KEY) !== "off";
  } catch {
    return true;
  }
}

export interface SnapshotState {
  readonly race: RaceStateDto | null;
  /** Whether the page is refreshing itself. */
  readonly auto: boolean;
  readonly setAuto: (value: boolean) => void;
  /** How often this client is checking, in milliseconds. */
  readonly intervalMs: number;
  /** Update time of the data currently displayed; changes drive refetches. */
  readonly fetchedAt: number | null;
  readonly error: string | null;
  readonly lastPolledAt: number;
}

/**
 * Watch the small race endpoint and expose its update time. Data hooks depend
 * on that timestamp, so the page refreshes itself without a reload and
 * without every component polling the heavy endpoints.
 */
export function useRaceState(): SnapshotState & { refresh: () => void } {
  const [race, setRace] = useState<RaceStateDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastPolledAt, setLastPolledAt] = useState(() => Date.now());
  const [auto, setAutoState] = useState(true);
  const inFlight = useRef(false);

  useEffect(() => setAutoState(readAuto()), []);

  const setAuto = useCallback((value: boolean) => {
    setAutoState(value);
    try {
      window.localStorage.setItem(AUTO_KEY, value ? "on" : "off");
    } catch {
      // A browser with storage disabled still works; it just forgets.
    }
  }, []);

  const poll = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const response = await fetch("/api/race", { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json()) as RaceStateDto;
      setRaceClockOffset(body.now);
      setRace(body);
      setError(null);
    } catch {
      setError("最新の状況を取得できませんでした。再試行しています。");
    } finally {
      inFlight.current = false;
      setLastPolledAt(Date.now());
    }
  }, []);

  const intervalMs = clientPollMs(race?.pollIntervalMs);

  useEffect(() => {
    void poll();
  }, [poll]);

  useEffect(() => {
    // Once the race is over the file cannot change, so polling it is load on
    // the server for nothing and a countdown the reader should not be watching.
    if (!auto || race?.finalResults === true) return;
    const timer = setInterval(() => void poll(), intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll, intervalMs, auto, race?.finalResults]);

  return {
    race,
    auto,
    setAuto,
    intervalMs,
    fetchedAt: race?.fetchedAt ?? null,
    error,
    lastPolledAt,
    refresh: () => void poll(),
  };
}

/**
 * One in-flight request per URL, shared by every caller. The header and the
 * page below it both want the bookmarked athletes, and without this they
 * would each fetch the same payload on every update.
 */
const inFlight = new Map<string, Promise<unknown>>();

function fetchOnce<T>(url: string): Promise<T> {
  const existing = inFlight.get(url);
  if (existing) return existing as Promise<T>;

  const request = fetch(url, { cache: "no-store" })
    .then(async (response) => {
      if (response.status === 404) throw new NotFoundError();
      if (!response.ok) throw new Error(String(response.status));
      return (await response.json()) as T;
    })
    .finally(() => inFlight.delete(url));

  inFlight.set(url, request);
  return request;
}

class NotFoundError extends Error {
  constructor() {
    super("not found");
    this.name = "NotFoundError";
  }
}

/**
 * Fetch a URL again whenever the race data changes. The update time is part
 * of the request so a browser cache can never serve an older body.
 */
export function useLiveResource<T>(
  url: string | null,
  fetchedAt: number | null,
): {
  data: T | null;
  error: string | null;
  /** True when the server said the resource does not exist. */
  missing: boolean;
  loading: boolean;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(url !== null);

  useEffect(() => {
    if (url === null) {
      setData(null);
      setMissing(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const separator = url.includes("?") ? "&" : "?";
    const versioned = fetchedAt === null ? url : `${url}${separator}v=${fetchedAt}`;

    void (async () => {
      try {
        const body = await fetchOnce<T>(versioned);
        if (!cancelled) {
          setData(body);
          setMissing(false);
          setError(null);
        }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof NotFoundError) {
          setMissing(true);
          setError(null);
        } else {
          setError("データを取得できませんでした。");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url, fetchedAt]);

  return { data, error, missing, loading };
}
