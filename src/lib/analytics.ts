"use client";

/**
 * Product events, sent only when analytics is switched on. Nothing here
 * identifies a person: an event says that a bookmark was added, and from
 * which screen, never who added it or who they follow.
 */
type EventName = "bookmark_add" | "bookmark_remove" | "share";

interface EventParams {
  /** Where the action was taken, e.g. "search", "card", "athlete". */
  readonly source: string;
  /** For a share, where it was sent: "x", "facebook", "line", "clipboard". */
  readonly network?: string;
}

type Gtag = (command: "event", name: string, params: Record<string, unknown>) => void;

/**
 * Query parameters that may be reported with a page view, listed rather than
 * excluded. `?bibs=` hands over the reader's whole bookmark list and `?bib=`
 * the one athlete they came for, and both used to reach analytics intact
 * because the address was reported as it arrived. An allowlist means a
 * parameter added later cannot leak by being forgotten here, which is the
 * same reasoning `shareUrl` applies to a shared address.
 */
const REPORTABLE_PARAMS: readonly string[] = ["div", "discipline", "ageGroup", "page"];

/** The address of a page view, with anything that names a person removed. */
export function reportedPath(pathname: string, params: URLSearchParams): string {
  const kept = new URLSearchParams();
  for (const name of REPORTABLE_PARAMS) {
    const value = params.get(name);
    if (value !== null) kept.set(name, value);
  }
  const query = kept.toString();
  return query === "" ? pathname : `${pathname}?${query}`;
}

export function track(name: EventName, params: EventParams): void {
  if (typeof window === "undefined") return;
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  if (typeof gtag !== "function") return;
  gtag("event", name, { ...params });
}
