const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * When the race stops producing results, in epoch milliseconds.
 *
 * It is the hour the poller stops asking the timing site on race day: after
 * that the file cannot change, so anyone still on the course without a finish
 * has not finished. Returns null when no window is set, which is the case in
 * replay and in local development, where nothing should be declared over.
 */
export function raceEndsAt(
  raceDate: string,
  env: Partial<NodeJS.ProcessEnv> = process.env,
): number | null {
  if ((env.FETCH_WINDOW ?? "").toLowerCase() === "off") return null;
  if (env.REPLAY_START) return null;

  const toHour = Number(env.FETCH_TO_HOUR ?? "23");
  if (!Number.isFinite(toHour)) return null;

  const midnightJst = Date.parse(`${raceDate}T00:00:00+09:00`);
  if (Number.isNaN(midnightJst)) return null;
  return midnightJst + toHour * 60 * 60 * 1000;
}

export { JST_OFFSET_MS };
