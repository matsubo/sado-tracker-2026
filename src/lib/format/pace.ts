/**
 * Pace, speed and distance formatting.
 *
 * Pace values are truncated to whole seconds to match the upstream timing
 * system, while speeds and distances are rounded by toFixed as usual.
 */

const DASH = "—";
const SECOND = 1000;
const MINUTE = 60;
const HOUR_MS = 3_600_000;
const METRES_PER_KM = 1000;
const SWIM_SEGMENT_M = 100;

/** Formats whole seconds as "m:ss" with unpadded minutes. */
const minutesSeconds = (totalSeconds: number): string => {
  const m = Math.floor(totalSeconds / MINUTE);
  const s = totalSeconds % MINUTE;
  return `${m}:${String(s).padStart(2, "0")}`;
};

/** True when an elapsed time can be used as the numerator of a pace. */
const hasTime = (ms: number): boolean => Number.isFinite(ms) && ms >= 0;

/** True when a distance can be used as the denominator of a pace. */
const hasDistance = (km: number): boolean => Number.isFinite(km) && km > 0;

/** Truncated seconds spent per unit of distance. */
const secondsPerUnit = (ms: number, units: number): number => Math.floor(ms / SECOND / units);

/** Formats a swim pace as "m:ss /100m" for the given elapsed time and distance. */
export function formatSwimPace(ms: number, km: number): string {
  if (!hasTime(ms) || !hasDistance(km)) return DASH;
  const segments = (km * METRES_PER_KM) / SWIM_SEGMENT_M;
  return `${minutesSeconds(secondsPerUnit(ms, segments))} /100m`;
}

/** Formats an average bike speed as "32.1 km/h" for the given time and distance. */
export function formatBikeSpeed(ms: number, km: number): string {
  if (!Number.isFinite(ms) || ms <= 0 || !hasDistance(km)) return DASH;
  return formatSpeedKmh(km / (ms / HOUR_MS));
}

/** Formats a run pace as "m:ss /km" for the given elapsed time and distance. */
export function formatRunPace(ms: number, km: number): string {
  if (!hasTime(ms) || !hasDistance(km)) return DASH;
  return `${minutesSeconds(secondsPerUnit(ms, km))} /km`;
}

/** Formats a speed in kilometres per hour with one decimal place. */
export function formatSpeedKmh(kmh: number): string {
  if (!Number.isFinite(kmh)) return DASH;
  return `${kmh.toFixed(1)} km/h`;
}

/** Formats a distance in kilometres, with no decimal places by default. */
export function formatKm(km: number, decimals = 0): string {
  if (!Number.isFinite(km)) return DASH;
  return `${km.toFixed(decimals)} km`;
}
