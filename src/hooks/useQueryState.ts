"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

/** A new place the back button should return from, or a narrower view of this one. */
export type QueryMode = "push" | "replace";

/**
 * The one way a screen reads and writes its query string. A null value drops
 * the key, so a default never clutters the address, and writing the address
 * the reader is already at does nothing, so an effect can sync safely.
 *
 * The address is written with the history API rather than the router: the
 * App Router syncs `useSearchParams` with `pushState` and `replaceState`, and
 * unlike `router.replace` neither asks the server for the page again. These
 * screens fetch their own data, so a tab or filter change should cost one API
 * call, not a server render on top of it.
 */
export function useQueryState(): {
  readonly params: URLSearchParams;
  readonly update: (next: Readonly<Record<string, string | null>>, mode?: QueryMode) => void;
} {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const params = useMemo(() => new URLSearchParams(searchParams?.toString() ?? ""), [searchParams]);

  const update = useCallback(
    (next: Readonly<Record<string, string | null>>, mode: QueryMode = "replace") => {
      const search = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value === null || value === "") search.delete(key);
        else search.set(key, value);
      }
      const query = search.toString();
      if (query === params.toString()) return;
      const href = query === "" ? pathname : `${pathname}?${query}`;
      if (mode === "push") window.history.pushState(null, "", href);
      else window.history.replaceState(null, "", href);
    },
    [params, pathname],
  );

  return { params, update };
}
