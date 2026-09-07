// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { WeatherPanel } from "@/components/tracker/WeatherPanel";
import type { ForecastHour, WeatherData } from "@/lib/weather/types";

afterEach(cleanup);

const HOUR_MS = 60 * 60 * 1000;

function hourAt(timeMs: number): ForecastHour {
  return {
    timeMs,
    weatherCode: 1,
    label: "晴れ",
    icon: "🌤️",
    temperatureC: 24,
    humidityPct: 70,
    precipitationMm: 0,
    windSpeedMs: 3,
    windDirectionDeg: 90,
    windDirectionLabel: "東",
  };
}

function weatherWithData(): WeatherData {
  const now = Date.now();
  return {
    available: true,
    forecast: [0, 3, 6, 9].map((offset) => hourAt(now + offset * HOUR_MS)),
    observation: {
      timeMs: now,
      station: "相川",
      temperatureC: 23.3,
      humidityPct: 88,
      windSpeedMs: 2.2,
      windDirectionLabel: "東北東",
    },
    fetchedAt: now,
  };
}

describe("WeatherPanel", () => {
  it("names Sado City as the place the forecast is for", () => {
    render(<WeatherPanel weather={weatherWithData()} />);
    expect(screen.getByRole("heading", { name: "天気 · 佐渡市" })).toBeInTheDocument();
  });

  it("names Sado City even when there is nothing to show", () => {
    render(<WeatherPanel weather={null} />);
    expect(screen.getByRole("heading", { name: "天気 · 佐渡市" })).toBeInTheDocument();
    expect(screen.getByText("天気情報を取得できませんでした。")).toBeInTheDocument();
  });

  it("keeps the observing station's own name next to the live reading", () => {
    render(<WeatherPanel weather={weatherWithData()} />);
    expect(screen.getByText(/実況 相川/)).toBeInTheDocument();
  });
});
