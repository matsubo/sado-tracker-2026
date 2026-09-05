/**
 * Contract types for the weather layer.
 *
 * Two independent sources are combined:
 * - Open-Meteo forecast (3-hourly, next days) -> {@link ForecastHour}
 * - JMA AMeDAS latest observation at Aikawa, Sado -> {@link Observation}
 */

/** One 3-hourly forecast slot. */
export interface ForecastHour {
  /** Absolute epoch milliseconds (UTC) for the start of the slot. */
  timeMs: number;
  /** WMO 4677-derived weather code as returned by Open-Meteo. */
  weatherCode: number;
  /** Japanese description of {@link weatherCode}. */
  label: string;
  /** Emoji glyph for {@link weatherCode}. */
  icon: string;
  temperatureC: number;
  humidityPct: number;
  precipitationMm: number;
  /** Wind speed in metres per second. */
  windSpeedMs: number;
  /** Meteorological wind direction in degrees (0 = from the north). */
  windDirectionDeg: number;
  /** Japanese 16-point compass label for {@link windDirectionDeg}. */
  windDirectionLabel: string;
}

/** A single AMeDAS observation. Fields are null when unreported or flagged. */
export interface Observation {
  /** Absolute epoch milliseconds (UTC) of the observation. */
  timeMs: number;
  /** Japanese station name, e.g. "相川". */
  station: string;
  temperatureC: number | null;
  humidityPct: number | null;
  windSpeedMs: number | null;
  windDirectionLabel: string | null;
}

/** Combined payload returned by `getWeather()`. */
export interface WeatherData {
  /** True when at least one of the two sources produced data. */
  available: boolean;
  forecast: ForecastHour[];
  observation: Observation | null;
  /** Epoch milliseconds at which this payload was assembled. */
  fetchedAt: number;
}
