const DEFAULT_YEAR = 2026;

/**
 * The edition being served. It lives here rather than in the poller because
 * routes that render no live data still need it, and importing the poller for
 * one number would start the whole fetching machinery.
 */
export function raceYear(env: Partial<NodeJS.ProcessEnv> = process.env): number {
  const year = Number(env.RACE_YEAR ?? DEFAULT_YEAR);
  return Number.isFinite(year) ? year : DEFAULT_YEAR;
}
