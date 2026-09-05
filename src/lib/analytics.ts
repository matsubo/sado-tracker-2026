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

export function track(name: EventName, params: EventParams): void {
  if (typeof window === "undefined") return;
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  if (typeof gtag !== "function") return;
  gtag("event", name, { ...params });
}
