import type { ForecastHour } from "./types";

/** Sawata, Sado Island — the race hub used as the forecast point. */
const LATITUDE = 38.02;
const LONGITUDE = 138.37;
const FORECAST_DAYS = 2;
const REQUEST_TIMEOUT_MS = 10_000;
const HOURLY_FIELDS = [
  "weather_code",
  "temperature_2m",
  "relative_humidity_2m",
  "precipitation",
  "wind_speed_10m",
  "wind_direction_10m",
] as const;

/**
 * Japanese 16-point compass, clockwise from north.
 * Index i covers the sector centred on i * 22.5 degrees.
 */
const COMPASS_POINTS = [
  "北",
  "北北東",
  "北東",
  "東北東",
  "東",
  "東南東",
  "南東",
  "南南東",
  "南",
  "南南西",
  "南西",
  "西南西",
  "西",
  "西北西",
  "北西",
  "北北西",
] as const;

/** A weather code rendered for display. `icon` is an emoji glyph. */
export interface DescribedWeather {
  label: string;
  icon: string;
}

/**
 * WMO 4677 codes as emitted by Open-Meteo, with Japanese labels.
 * Code 0 is 快晴 (clear) and 1 is 晴れ (mainly clear); the two are kept
 * distinct because Japanese forecasts treat them as different states.
 */
const WEATHER_CODES: ReadonlyMap<number, DescribedWeather> = new Map([
  [0, { label: "快晴", icon: "☀️" }],
  [1, { label: "晴れ", icon: "🌤️" }],
  [2, { label: "薄曇り", icon: "⛅" }],
  [3, { label: "曇り", icon: "☁️" }],
  [45, { label: "霧", icon: "🌫️" }],
  [48, { label: "着氷性の霧", icon: "🌫️" }],
  [51, { label: "弱い霧雨", icon: "🌦️" }],
  [53, { label: "霧雨", icon: "🌦️" }],
  [55, { label: "強い霧雨", icon: "🌧️" }],
  [56, { label: "弱い着氷性の霧雨", icon: "🌧️" }],
  [57, { label: "着氷性の霧雨", icon: "🌧️" }],
  [61, { label: "弱い雨", icon: "🌦️" }],
  [63, { label: "雨", icon: "🌧️" }],
  [65, { label: "強い雨", icon: "🌧️" }],
  [66, { label: "弱い着氷性の雨", icon: "🌧️" }],
  [67, { label: "着氷性の雨", icon: "🌧️" }],
  [71, { label: "弱い雪", icon: "🌨️" }],
  [73, { label: "雪", icon: "🌨️" }],
  [75, { label: "強い雪", icon: "❄️" }],
  [77, { label: "霧雪", icon: "🌨️" }],
  [80, { label: "弱いにわか雨", icon: "🌦️" }],
  [81, { label: "にわか雨", icon: "🌧️" }],
  [82, { label: "激しいにわか雨", icon: "⛈️" }],
  [85, { label: "弱いにわか雪", icon: "🌨️" }],
  [86, { label: "強いにわか雪", icon: "❄️" }],
  [95, { label: "雷雨", icon: "⛈️" }],
  [96, { label: "雷雨（弱い雹）", icon: "⛈️" }],
  [99, { label: "雷雨（激しい雹）", icon: "⛈️" }],
]);

const UNKNOWN_WEATHER: DescribedWeather = { label: "不明", icon: "❓" };

/** Look up a WMO weather code. Unknown codes fall back rather than throwing. */
export function describeWeatherCode(code: number): DescribedWeather {
  return WEATHER_CODES.get(code) ?? UNKNOWN_WEATHER;
}

/**
 * Convert a meteorological wind direction in degrees to one of the 16
 * Japanese compass points. Handles negative values and values over 360.
 */
export function degreesToJapaneseCompass(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % 16;
  return COMPASS_POINTS[index] ?? COMPASS_POINTS[0];
}

/** Shape of the slice of the Open-Meteo response this module consumes. */
interface OpenMeteoResponse {
  utc_offset_seconds?: unknown;
  hourly?: Record<string, unknown>;
}

function buildUrl(): string {
  const params = new URLSearchParams({
    latitude: String(LATITUDE),
    longitude: String(LONGITUDE),
    hourly: HOURLY_FIELDS.join(","),
    timezone: "Asia/Tokyo",
    forecast_days: String(FORECAST_DAYS),
    wind_speed_unit: "ms",
    timeformat: "unixtime",
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

/** Combine the caller's signal with a hard 10 s timeout. */
export function withTimeout(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return signal === undefined ? timeout : AbortSignal.any([signal, timeout]);
}

function numbersAt(hourly: Record<string, unknown>, key: string): readonly unknown[] {
  const value = hourly[key];
  return Array.isArray(value) ? value : [];
}

function finiteAt(column: readonly unknown[], index: number): number | null {
  const value = column[index];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Fetch the Sado forecast and reduce it to 3-hourly slots.
 *
 * Open-Meteo returns hourly rows; we keep the ones whose local (JST) hour is
 * divisible by three. The JST offset is +9 h, itself a multiple of three, so
 * UTC and JST agree on which hours qualify — the offset is applied anyway so
 * the rule stays correct if the point ever moves to another timezone.
 *
 * @throws when the request fails or the response is not usable.
 */
export async function fetchForecast(signal?: AbortSignal): Promise<ForecastHour[]> {
  const response = await fetch(buildUrl(), { signal: withTimeout(signal) });
  if (!response.ok) {
    throw new Error(`Open-Meteo request failed with status ${response.status}`);
  }

  const body = (await response.json()) as OpenMeteoResponse;
  const hourly = body.hourly;
  if (hourly === undefined || hourly === null) {
    throw new Error("Open-Meteo response contained no hourly block");
  }

  const offsetSeconds = typeof body.utc_offset_seconds === "number" ? body.utc_offset_seconds : 0;
  const times = numbersAt(hourly, "time");
  const codes = numbersAt(hourly, "weather_code");
  const temperatures = numbersAt(hourly, "temperature_2m");
  const humidities = numbersAt(hourly, "relative_humidity_2m");
  const precipitations = numbersAt(hourly, "precipitation");
  const windSpeeds = numbersAt(hourly, "wind_speed_10m");
  const windDirections = numbersAt(hourly, "wind_direction_10m");

  // flatMap rather than a reduce with a spread accumulator: same immutability,
  // linear cost. A slot missing any field is dropped instead of guessed at.
  return times.flatMap((_entry, index): ForecastHour[] => {
    const time = finiteAt(times, index);
    if (time === null) return [];

    const localHour = Math.floor((time + offsetSeconds) / 3600) % 24;
    if (localHour % 3 !== 0) return [];

    const weatherCode = finiteAt(codes, index);
    const temperatureC = finiteAt(temperatures, index);
    const humidityPct = finiteAt(humidities, index);
    const precipitationMm = finiteAt(precipitations, index);
    const windSpeedMs = finiteAt(windSpeeds, index);
    const windDirectionDeg = finiteAt(windDirections, index);
    if (
      weatherCode === null ||
      temperatureC === null ||
      humidityPct === null ||
      precipitationMm === null ||
      windSpeedMs === null ||
      windDirectionDeg === null
    ) {
      return [];
    }

    const described = describeWeatherCode(weatherCode);
    return [
      {
        timeMs: time * 1000,
        weatherCode,
        label: described.label,
        icon: described.icon,
        temperatureC,
        humidityPct,
        precipitationMm,
        windSpeedMs,
        windDirectionDeg,
        windDirectionLabel: degreesToJapaneseCompass(windDirectionDeg),
      },
    ];
  });
}
