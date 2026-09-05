"use client";

import { useEffect, useRef, useState } from "react";
import type { AthleteSummaryDto } from "@/lib/api/contract";

/** Long enough that a fast typist does not fire a request per keystroke. */
const DEBOUNCE_MS = 200;

export interface SearchState {
  readonly results: readonly AthleteSummaryDto[];
  readonly searching: boolean;
  /** Set only when the search itself failed, not when it found nothing. */
  readonly error: string | null;
  /** True once a search for the current text has completed. */
  readonly settled: boolean;
}

/**
 * Suggest athletes as the reader types. A supporter often knows a family name
 * or half a bib and nothing else, so results appear from the first character
 * rather than waiting for a submit.
 */
export function useAthleteSearch(query: string): SearchState {
  const [state, setState] = useState<SearchState>({
    results: [],
    searching: false,
    error: null,
    settled: false,
  });
  const requestId = useRef(0);

  useEffect(() => {
    const term = query.trim();
    if (term === "") {
      requestId.current += 1;
      setState({ results: [], searching: false, error: null, settled: false });
      return;
    }

    setState((current) => ({ ...current, searching: true, error: null }));
    const id = ++requestId.current;
    const controller = new AbortController();

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/athletes?q=${encodeURIComponent(term)}`, {
            cache: "no-store",
            signal: controller.signal,
          });
          if (!response.ok) throw new Error(String(response.status));
          const body = (await response.json()) as { athletes: AthleteSummaryDto[] };
          // Ignore a slow response that a newer keystroke has superseded.
          if (id !== requestId.current) return;
          setState({ results: body.athletes, searching: false, error: null, settled: true });
        } catch (error) {
          if (controller.signal.aborted || id !== requestId.current) return;
          void error;
          setState({
            results: [],
            searching: false,
            error: "検索できませんでした。少し待って試してください。",
            settled: true,
          });
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return state;
}
