import { fetchObservation } from "./amedas";
import { fetchForecast } from "./openMeteo";
import type { ForecastHour, Observation, WeatherData } from "./types";

export {
  AIKAWA_STATION_NUMBER,
  fetchObservation,
  parseObservation,
  windDirectionCodeToLabel,
} from "./amedas";
export { degreesToJapaneseCompass, describeWeatherCode, fetchForecast } from "./openMeteo";
export type { ForecastHour, Observation, WeatherData } from "./types";

const FORECAST_TTL_MS = 5 * 60 * 1000;
const OBSERVATION_TTL_MS = 10 * 60 * 1000;

interface CacheSlot<T> {
  value: T;
  storedAt: number;
}

/**
 * Module-level cache. The two sources expire independently: the forecast is
 * regenerated hourly upstream but is cheap to poll, while AMeDAS publishes a
 * new snapshot every ten minutes. Only successes are cached, so a transient
 * outage does not pin `available: false` for the length of a TTL.
 */
let forecastCache: CacheSlot<ForecastHour[]> | null = null;
let observationCache: CacheSlot<Observation> | null = null;

function isFresh<T>(slot: CacheSlot<T> | null, ttlMs: number, now: number): slot is CacheSlot<T> {
  return slot !== null && now - slot.storedAt < ttlMs;
}

/** Test helper: drop both cached slots. */
export function resetWeatherCache(): void {
  forecastCache = null;
  observationCache = null;
}

async function loadForecast(now: number): Promise<ForecastHour[]> {
  if (isFresh(forecastCache, FORECAST_TTL_MS, now)) return forecastCache.value;

  try {
    const forecast = await fetchForecast();
    if (forecast.length > 0) {
      forecastCache = { value: forecast, storedAt: now };
    }
    return forecast;
  } catch {
    // Forecast is optional; the observation may still succeed.
    return [];
  }
}

async function loadObservation(now: number): Promise<Observation | null> {
  if (isFresh(observationCache, OBSERVATION_TTL_MS, now)) return observationCache.value;

  const observation = await fetchObservation();
  if (observation !== null) {
    observationCache = { value: observation, storedAt: now };
  }
  return observation;
}

/**
 * Fetch the forecast and the latest observation, serving each from its own
 * cache when fresh. Never throws: when both sources fail the result is
 * `{ available: false, forecast: [], observation: null }`.
 */
export async function getWeather(): Promise<WeatherData> {
  const now = Date.now();
  const [forecastResult, observationResult] = await Promise.allSettled([
    loadForecast(now),
    loadObservation(now),
  ]);

  const forecast = forecastResult.status === "fulfilled" ? forecastResult.value : [];
  const observation = observationResult.status === "fulfilled" ? observationResult.value : null;

  return {
    available: forecast.length > 0 || observation !== null,
    forecast,
    observation,
    fetchedAt: now,
  };
}
