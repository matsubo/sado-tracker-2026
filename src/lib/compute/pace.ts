const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

/** Minutes per kilometre, or null when either side is not a positive number. */
export function paceMinPerKm(ms: number, km: number): number | null {
  if (ms <= 0 || km <= 0) return null;
  return ms / MINUTE_MS / km;
}

/** Kilometres per hour, or null when either side is not a positive number. */
export function speedKmh(km: number, ms: number): number | null {
  if (km <= 0 || ms <= 0) return null;
  return km / (ms / HOUR_MS);
}
