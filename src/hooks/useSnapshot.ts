"use client";

import { useContext, useEffect, useState } from "react";
import { RaceContext, type RaceState } from "@/state/RaceProvider";

/** The app's one view of the race endpoint; see RaceProvider. */
export function useRaceState(): RaceState {
  const value = useContext(RaceContext);
  if (value === null) throw new Error("useRaceState must be used within RaceProvider");
  return value;
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
