/**
 * Everything that names this edition of the tracker derives from one number.
 * Next year's site is a change here plus a race config, not a search through
 * the tree for a four-digit literal.
 */
export const EDITION_YEAR = 2026;

export const SITE_SHORT_NAME = "佐渡トラッカー";
export const SITE_NAME = `${SITE_SHORT_NAME} ${EDITION_YEAR}`;
export const SITE_DESCRIPTION =
  "佐渡国際トライアスロンの応援トラッカー。ブックマークした選手の現在地、順位、ゴール予想タイムがひと目でわかります。";

/** Canonical origin, used for Open Graph tags and the fetch user agent. */
export const DEFAULT_SITE_URL = `https://sado-tracker-${EDITION_YEAR}.teraren.com`;
export const REPO_URL = `https://github.com/matsubo/sado-tracker-${EDITION_YEAR}`;

/**
 * Browser storage is scoped to the edition on purpose: a bookmark list or a
 * set of seen checkpoints from one race means nothing at the next.
 */
export const STORAGE_PREFIX = `sado${EDITION_YEAR}`;

export function storageKey(name: string): string {
  return `${STORAGE_PREFIX}.${name}`;
}
