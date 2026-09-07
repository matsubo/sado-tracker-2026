"use client";

import { createContext, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { storageKey } from "@/config/site";
import type { RaceStateDto } from "@/lib/api/contract";
import { setRaceClockOffset } from "@/lib/runtime/raceClock";

const DEFAULT_POLL_MS = 15_000;
const MIN_POLL_MS = 1_000;
const AUTO_KEY = storageKey("autoRefresh");

/**
 * Check at least as often as the server recomputes, so a fast replay is not
 * watched through a fifteen-second window. Never faster than once a second.
 */
function clientPollMs(serverIntervalMs: number | undefined): number {
  if (serverIntervalMs === undefined) return DEFAULT_POLL_MS;
  return Math.max(MIN_POLL_MS, Math.min(DEFAULT_POLL_MS, serverIntervalMs));
}

function readAuto(): boolean {
  try {
    return window.localStorage.getItem(AUTO_KEY) !== "off";
  } catch {
    return true;
  }
}

export interface RaceState {
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
  readonly refresh: () => void;
}

export const RaceContext = createContext<RaceState | null>(null);

/**
 * One watcher of the small race endpoint for the whole app. Every screen and
 * the header read the same update time from here, so the page refreshes
 * itself without a reload and without each component polling on its own.
 */
export function RaceProvider({ children }: { readonly children: ReactNode }) {
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

  const value: RaceState = {
    race,
    auto,
    setAuto,
    intervalMs,
    fetchedAt: race?.fetchedAt ?? null,
    error,
    lastPolledAt,
    refresh: () => void poll(),
  };

  return <RaceContext.Provider value={value}>{children}</RaceContext.Provider>;
}
