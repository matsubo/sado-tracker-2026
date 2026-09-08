const EVENTS_PATH = "/api/events";

/**
 * The one URL for one list of athletes: the request the browser sends, and
 * the self link the answer comes back with. Both sides build it here so a
 * client can read the list back out of an answer it is holding.
 */
export function eventsHref(bibs: readonly string[]): string {
  return bibs.length === 0
    ? EVENTS_PATH
    : `${EVENTS_PATH}?bibs=${encodeURIComponent(bibs.join(","))}`;
}

/** The athletes an events link names, in the order it names them. */
export function bibsFromEventsHref(href: string): readonly string[] {
  const [, query = ""] = href.split("?");
  return (new URLSearchParams(query).get("bibs") ?? "")
    .split(",")
    .map((bib) => bib.trim())
    .filter(Boolean);
}
