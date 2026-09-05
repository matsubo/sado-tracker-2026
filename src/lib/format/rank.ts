/**
 * Ranking and deviation-score formatting.
 *
 * Ranks are only meaningful alongside the size of the field they were taken
 * from, so both halves are rendered together and a missing half collapses the
 * whole value to a dash.
 */

const DASH = "—";

/** Formats a rank and field size as "201/412". */
export function formatRank(rank: number, of: number): string {
  return `${rank}/${of}`;
}

/** Formats a rank and field size as "201/412", or a dash when either is missing. */
export function formatRankOrDash(rank: number | null, of: number | null): string {
  if (rank === null || of === null) return DASH;
  if (!Number.isFinite(rank) || !Number.isFinite(of)) return DASH;
  return formatRank(rank, of);
}

/** Formats a deviation score as a rounded integer, or a dash when missing. */
export function formatDeviation(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return DASH;
  return String(Math.round(value));
}
