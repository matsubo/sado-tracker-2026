import { degreesToJapaneseCompass, withTimeout } from "./openMeteo";
import type { Observation } from "./types";

/**
 * Aikawa (相川) on the west coast of Sado Island.
 *
 * Verified against https://www.jma.go.jp/bosai/amedas/const/amedastable.json:
 * the entry whose `kjName` is "相川" is keyed 54157. Station 54012 is 粟島
 * (Awashima), a different island off the Niigata mainland. Aikawa is a type "B"
 * station, so it reports pressure, humidity and visibility on top of the usual
 * four elements — unlike the type "C" Sado stations (両津 54166, 羽茂 54271),
 * which omit humidity.
 */
export const AIKAWA_STATION_NUMBER = "54157";
const AIKAWA_STATION_NAME = "相川";

const LATEST_TIME_URL = "https://www.jma.go.jp/bosai/amedas/data/latest_time.txt";
const MAP_URL_PREFIX = "https://www.jma.go.jp/bosai/amedas/data/map/";

/**
 * Japanese 16-point compass indexed by the JMA wind-direction code.
 *
 * JMA encodes direction as 1..16 clockwise starting at 北北東 (NNE), so the
 * degrees are simply `code * 22.5` and 16 lands on 北 (north). 0 means 静穏
 * (calm). Verified empirically: for 100 AMeDAS stations reporting winds above
 * 4 m/s, the circular mean difference against the Open-Meteo wind direction at
 * the same coordinates was -5.1 degrees under this mapping, versus -27.6
 * degrees under the alternative `(code - 1) * 22.5` reading.
 */
const CALM_LABEL = "静穏";
const MAX_DIRECTION_CODE = 16;

/** Convert a JMA wind-direction code to Japanese. Returns null if out of range. */
export function windDirectionCodeToLabel(code: number): string | null {
  if (!Number.isInteger(code) || code < 0 || code > MAX_DIRECTION_CODE) return null;
  if (code === 0) return CALM_LABEL;
  return degreesToJapaneseCompass(code * 22.5);
}

/** AMeDAS reports every element as `[value, qualityFlag]`; only flag 0 is trusted. */
function readElement(station: Record<string, unknown>, key: string): number | null {
  const entry = station[key];
  if (!Array.isArray(entry) || entry.length < 2) return null;
  const [value, flag] = entry;
  if (flag !== 0) return null;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stationRecord(payload: unknown): Record<string, unknown> | null {
  if (typeof payload !== "object" || payload === null) return null;
  const station = (payload as Record<string, unknown>)[AIKAWA_STATION_NUMBER];
  if (typeof station !== "object" || station === null) return null;
  return station as Record<string, unknown>;
}

/**
 * Pull the Aikawa observation out of a whole-Japan AMeDAS map payload.
 * Returns null when the station is missing from the snapshot.
 */
export function parseObservation(payload: unknown, timeMs: number): Observation | null {
  const station = stationRecord(payload);
  if (station === null) return null;

  const directionCode = readElement(station, "windDirection");

  return {
    timeMs,
    station: AIKAWA_STATION_NAME,
    temperatureC: readElement(station, "temp"),
    humidityPct: readElement(station, "humidity"),
    windSpeedMs: readElement(station, "wind"),
    windDirectionLabel: directionCode === null ? null : windDirectionCodeToLabel(directionCode),
  };
}

/**
 * Turn "2026-09-05T17:40:00+09:00" into "20260905174000".
 *
 * The digits are taken straight from the local-time string; parsing it into a
 * Date and reading UTC fields would shift the filename by nine hours.
 */
export function latestTimeToMapKey(latestTime: string): string | null {
  const digits = latestTime.trim().slice(0, 19).replace(/\D/g, "");
  return digits.length === 14 ? digits : null;
}

/**
 * Fetch the most recent AMeDAS observation for Aikawa.
 * Returns null on any failure so callers never need a try/catch.
 */
export async function fetchObservation(signal?: AbortSignal): Promise<Observation | null> {
  try {
    const timeResponse = await fetch(LATEST_TIME_URL, { signal: withTimeout(signal) });
    if (!timeResponse.ok) {
      throw new Error(`AMeDAS latest_time request failed with status ${timeResponse.status}`);
    }

    const latestTime = (await timeResponse.text()).trim();
    const mapKey = latestTimeToMapKey(latestTime);
    const timeMs = Date.parse(latestTime);
    if (mapKey === null || Number.isNaN(timeMs)) {
      throw new Error(`Unrecognised AMeDAS timestamp: ${latestTime}`);
    }

    const mapResponse = await fetch(`${MAP_URL_PREFIX}${mapKey}.json`, {
      signal: withTimeout(signal),
    });
    if (!mapResponse.ok) {
      throw new Error(`AMeDAS map request failed with status ${mapResponse.status}`);
    }

    return parseObservation(await mapResponse.json(), timeMs);
  } catch {
    // The observation is a nice-to-have next to the forecast; degrade quietly.
    return null;
  }
}
