export const SITE_NAME = "佐渡トラッカー 2026";

/** "ブックマーク | 佐渡トラッカー 2026", or just the site name for the shell. */
export function pageTitle(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  return trimmed === "" ? SITE_NAME : `${trimmed} | ${SITE_NAME}`;
}

/**
 * What the screen on show calls itself.
 *
 * Analytics cannot read this off `document.title`: on a client-side
 * navigation the framework re-applies the root layout's title after the page
 * has rendered, so the tab briefly carries the wrong name and whatever reads
 * it at that moment records the wrong page. The heading writes the name here
 * as it renders, and the page-view effect, which runs later, reads it.
 */
let currentName: string | null = null;

export function setPageName(name: string): void {
  currentName = name;
}

export function currentPageTitle(): string {
  return pageTitle(currentName);
}
