import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getWeather, resetWeatherCache } from "@/lib/weather";
import {
  AIKAWA_STATION_NUMBER,
  parseObservation,
  windDirectionCodeToLabel,
} from "@/lib/weather/amedas";
import {
  degreesToJapaneseCompass,
  describeWeatherCode,
  fetchForecast,
} from "@/lib/weather/openMeteo";
import amedasFixture from "../fixtures/amedas.json" with { type: "json" };
import openMeteoFixture from "../fixtures/open-meteo.json" with { type: "json" };

const LATEST_TIME = "2026-09-05T17:40:00+09:00";

/** First element of a fixture column, under `noUncheckedIndexedAccess`. */
function head(column: readonly number[]): number {
  const value = column[0];
  if (value === undefined) throw new Error("fixture column is empty");
  return value;
}

type FetchResult = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
  json: () => Promise<unknown>;
};

function jsonResponse(body: unknown): FetchResult {
  return {
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  };
}

function textResponse(body: string): FetchResult {
  return {
    ok: true,
    status: 200,
    text: () => Promise.resolve(body),
    json: () => Promise.reject(new Error("not json")),
  };
}

/** Routes by URL so the two AMeDAS calls return their own content type. */
function routeFetch(url: string): FetchResult {
  if (url.includes("api.open-meteo.com")) return jsonResponse(openMeteoFixture);
  if (url.includes("latest_time.txt")) return textResponse(`${LATEST_TIME}\n`);
  if (url.includes("/amedas/data/map/")) return jsonResponse(amedasFixture);
  throw new Error(`unexpected url: ${url}`);
}

function stubFetch(): ReturnType<typeof vi.fn> {
  const spy = vi.fn((input: string | URL) => Promise.resolve(routeFetch(String(input))));
  vi.stubGlobal("fetch", spy);
  return spy;
}

beforeEach(() => {
  resetWeatherCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("degreesToJapaneseCompass", () => {
  it("maps the cardinal and inter-cardinal points", () => {
    expect(degreesToJapaneseCompass(0)).toBe("北");
    expect(degreesToJapaneseCompass(45)).toBe("北東");
    expect(degreesToJapaneseCompass(90)).toBe("東");
    expect(degreesToJapaneseCompass(180)).toBe("南");
    expect(degreesToJapaneseCompass(270)).toBe("西");
    expect(degreesToJapaneseCompass(337.5)).toBe("北北西");
  });

  it("wraps around at 360 and beyond", () => {
    expect(degreesToJapaneseCompass(360)).toBe("北");
    expect(degreesToJapaneseCompass(720)).toBe("北");
    expect(degreesToJapaneseCompass(-22.5)).toBe("北北西");
  });

  it("rounds to the nearest of the 16 points", () => {
    expect(degreesToJapaneseCompass(11)).toBe("北");
    expect(degreesToJapaneseCompass(12)).toBe("北北東");
    expect(degreesToJapaneseCompass(354)).toBe("北");
  });
});

describe("describeWeatherCode", () => {
  it("maps representative WMO codes to Japanese", () => {
    expect(describeWeatherCode(0).label).toBe("快晴");
    expect(describeWeatherCode(2).label).toBe("薄曇り");
    expect(describeWeatherCode(3).label).toBe("曇り");
    expect(describeWeatherCode(45).label).toBe("霧");
    expect(describeWeatherCode(61).label).toBe("弱い雨");
    expect(describeWeatherCode(71).label).toBe("弱い雪");
    expect(describeWeatherCode(95).label).toBe("雷雨");
  });

  it("covers every documented code with a non-empty label and icon", () => {
    const codes = [
      0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85,
      86, 95, 96, 99,
    ];
    for (const code of codes) {
      const described = describeWeatherCode(code);
      expect(described.label.length).toBeGreaterThan(0);
      expect(described.icon.length).toBeGreaterThan(0);
    }
  });

  it("falls back instead of throwing on an unknown code", () => {
    expect(describeWeatherCode(1234).label).toBe("不明");
  });
});

describe("fetchForecast", () => {
  it("returns only 3-hourly slots parsed from the Open-Meteo response", async () => {
    stubFetch();
    const rows = await fetchForecast();

    // The fixture holds 24 hourly entries for one JST day -> 8 three-hourly rows.
    expect(rows).toHaveLength(8);
    for (const row of rows) {
      const jstHour = new Date(row.timeMs + 9 * 3600 * 1000).getUTCHours();
      expect(jstHour % 3).toBe(0);
    }
  });

  it("maps every field of the first slot", async () => {
    stubFetch();
    const rows = await fetchForecast();
    const first = rows[0];

    expect(first).toBeDefined();
    if (first === undefined) return;
    const hourly = openMeteoFixture.hourly;
    expect(first.timeMs).toBe(head(hourly.time) * 1000);
    expect(first.weatherCode).toBe(head(hourly.weather_code));
    expect(first.temperatureC).toBe(head(hourly.temperature_2m));
    expect(first.humidityPct).toBe(head(hourly.relative_humidity_2m));
    expect(first.precipitationMm).toBe(head(hourly.precipitation));
    expect(first.windSpeedMs).toBe(head(hourly.wind_speed_10m));
    expect(first.windDirectionDeg).toBe(head(hourly.wind_direction_10m));
    expect(first.label).toBe(describeWeatherCode(first.weatherCode).label);
    expect(first.windDirectionLabel).toBe(degreesToJapaneseCompass(first.windDirectionDeg));
  });

  it("requests wind speed in m/s and unix timestamps", async () => {
    const spy = stubFetch();
    await fetchForecast();
    const url = String(spy.mock.calls[0]?.[0]);
    expect(url).toContain("wind_speed_unit=ms");
    expect(url).toContain("timeformat=unixtime");
  });
});

describe("windDirectionCodeToLabel", () => {
  // Verified against 100 AMeDAS stations vs Open-Meteo: deg = code * 22.5, so 16 = 北.
  it("treats 16 as north and 0 as calm", () => {
    expect(windDirectionCodeToLabel(16)).toBe("北");
    expect(windDirectionCodeToLabel(0)).toBe("静穏");
    expect(windDirectionCodeToLabel(4)).toBe("東");
    expect(windDirectionCodeToLabel(8)).toBe("南");
    expect(windDirectionCodeToLabel(12)).toBe("西");
    expect(windDirectionCodeToLabel(1)).toBe("北北東");
  });

  it("rejects out-of-range codes", () => {
    expect(windDirectionCodeToLabel(17)).toBeNull();
    expect(windDirectionCodeToLabel(-1)).toBeNull();
  });
});

describe("parseObservation", () => {
  it("extracts temperature, humidity and wind for Aikawa", () => {
    const observation = parseObservation(amedasFixture, Date.parse(LATEST_TIME));

    expect(observation).not.toBeNull();
    expect(observation?.station).toBe("相川");
    expect(observation?.temperatureC).toBe(23.1);
    expect(observation?.humidityPct).toBe(68);
    expect(observation?.windSpeedMs).toBe(2.1);
    expect(observation?.windDirectionLabel).toBe("南");
    expect(observation?.timeMs).toBe(Date.parse(LATEST_TIME));
  });

  it("uses the verified Aikawa station number", () => {
    expect(AIKAWA_STATION_NUMBER).toBe("54157");
  });

  it("nulls out values whose quality flag is not zero", () => {
    const flagged = { "54157": { temp: [23.1, 1], humidity: [68, 0] } };
    const observation = parseObservation(flagged, 0);

    expect(observation?.temperatureC).toBeNull();
    expect(observation?.humidityPct).toBe(68);
    expect(observation?.windSpeedMs).toBeNull();
  });

  it("returns null when the station is absent", () => {
    expect(parseObservation({ "54166": { temp: [20, 0] } }, 0)).toBeNull();
  });
});

describe("getWeather", () => {
  it("combines both sources", async () => {
    stubFetch();
    const weather = await getWeather();

    expect(weather.available).toBe(true);
    expect(weather.forecast).toHaveLength(8);
    expect(weather.observation?.station).toBe("相川");
  });

  it("reports available:false without throwing when every request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("network down"))),
    );

    const weather = await getWeather();
    expect(weather.available).toBe(false);
    expect(weather.forecast).toEqual([]);
    expect(weather.observation).toBeNull();
  });

  it("reports available:false on a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 503,
          text: () => Promise.resolve(""),
          json: () => Promise.resolve({}),
        }),
      ),
    );

    const weather = await getWeather();
    expect(weather.available).toBe(false);
  });

  it("still reports available when only the observation fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL) => {
        const url = String(input);
        if (url.includes("api.open-meteo.com"))
          return Promise.resolve(jsonResponse(openMeteoFixture));
        return Promise.reject(new Error("jma down"));
      }),
    );

    const weather = await getWeather();
    expect(weather.available).toBe(true);
    expect(weather.observation).toBeNull();
    expect(weather.forecast).toHaveLength(8);
  });

  it("serves both sources from cache inside their windows", async () => {
    vi.useFakeTimers();
    const spy = stubFetch();

    await getWeather();
    const afterFirst = spy.mock.calls.length;
    expect(afterFirst).toBe(3); // forecast + latest_time + map

    await getWeather();
    expect(spy.mock.calls.length).toBe(afterFirst);
  });

  it("refetches the forecast after 5 minutes but keeps the observation for 10", async () => {
    vi.useFakeTimers();
    const spy = stubFetch();

    await getWeather();
    spy.mockClear();

    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await getWeather();

    const urls = spy.mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes("api.open-meteo.com"))).toBe(true);
    expect(urls.some((url) => url.includes("jma.go.jp"))).toBe(false);

    spy.mockClear();
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await getWeather();

    const later = spy.mock.calls.map((call) => String(call[0]));
    expect(later.some((url) => url.includes("jma.go.jp"))).toBe(true);
  });

  it("does not cache failures", async () => {
    vi.useFakeTimers();
    const failing = vi.fn(() => Promise.reject(new Error("network down")));
    vi.stubGlobal("fetch", failing);

    const first = await getWeather();
    expect(first.available).toBe(false);

    const spy = stubFetch();
    const second = await getWeather();

    expect(spy.mock.calls.length).toBe(3);
    expect(second.available).toBe(true);
  });
});
