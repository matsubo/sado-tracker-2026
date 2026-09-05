import { normalizeName } from "@/config/races";

/** Returned when the text appears in neither the bib nor the name. */
export const NO_MATCH = Number.MAX_SAFE_INTEGER;

/**
 * How well an athlete answers what the reader typed, lower being better.
 *
 * The tiers exist so a suggestion list is useful mid-word: someone who types
 * a family name wants the people called that before the people who merely
 * contain those characters somewhere. Both are matches; only the order
 * differs.
 *
 * A bib is matched anywhere, not just from the front, because a supporter
 * often remembers the last two digits of a number they read off a rack.
 */
export function matchScore(bib: string, nameKey: string, query: string): number {
  const needle = normalizeName(query);
  if (needle === "") return 0;
  const squashed = needle.replace(/ /g, "");
  const flatName = nameKey.replace(/ /g, "");

  if (bib === needle) return 0;
  if (bib.startsWith(needle)) return 1;
  if (nameKey.startsWith(needle)) return 2;
  if (flatName.startsWith(squashed)) return 3;
  if (nameKey.includes(needle)) return 4;
  if (flatName.includes(squashed)) return 5;
  if (bib.includes(needle)) return 6;
  return NO_MATCH;
}

/**
 * Whether this athlete should survive a filter. Empty text matches everyone,
 * so clearing the box restores the whole field rather than emptying it.
 */
export function matchesAthlete(bib: string, nameKey: string, query: string): boolean {
  return matchScore(bib, nameKey, query) !== NO_MATCH;
}
