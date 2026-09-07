"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

/** A new place the back button should return from, or a narrower view of this one. */
export type QueryMode = "push" | "replace";

/**
 * The one way a screen reads and writes its query string. A null value drops
 * the key, so a default never clutters the address, and writing the address
 * the reader is already at does nothing, so an effect can sync safely.
 */
export function useQueryState(): {
  readonly params: URLSearchParams;
  readonly update: (next: Readonly<Record<string, string | null>>, mode?: QueryMode) => void;
} {
  const router = useRouter();
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
      if (mode === "push") router.push(href, { scroll: false });
      else router.replace(href, { scroll: false });
    },
    [params, pathname, router],
  );

  return { params, update };
}
