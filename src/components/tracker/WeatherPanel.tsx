"use client";

import type { WeatherData } from "@/lib/weather/types";
import { formatClockShort } from "@/lib/format";

const ROWS = [
  { key: "weather", label: "天気" },
  { key: "temperature", label: "気温 ℃" },
  { key: "humidity", label: "湿度 %" },
  { key: "precipitation", label: "降水 mm" },
  { key: "wind", label: "風 m/s" },
] as const;

/** Forecast for the finish area plus the nearest live observation. */
export function WeatherPanel({ weather }: { weather: WeatherData | null }) {
  if (!weather || !weather.available || weather.forecast.length === 0) {
    return (
      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <h2 className="px-3.5 py-2.5 font-bold text-[13px]">天気 · 佐和田</h2>
        <p className="px-3.5 pb-3 text-[12px] text-muted-foreground">
          天気情報を取得できませんでした。
        </p>
      </section>
    );
  }

  const hours = weather.forecast.slice(0, 8);
  const observation = weather.observation;

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <header className="flex items-center justify-between px-3.5 py-2.5">
        <h2 className="font-bold text-[13px]">天気 · 佐和田</h2>
        {observation ? (
          <p className="text-[12px] text-muted-foreground tabular-nums">
            実況 {observation.station} {formatClockShort(observation.timeMs)}
          </p>
        ) : null}
      </header>

      {observation ? (
        <div className="flex gap-4 px-3.5 pb-2.5 text-[12px] text-muted-foreground tabular-nums">
          {observation.temperatureC !== null ? (
            <p>
              <b className="mr-0.5 font-semibold text-[20px] text-foreground">
                {observation.temperatureC.toFixed(1)}
              </b>
              ℃
            </p>
          ) : null}
          {observation.humidityPct !== null ? (
            <p>
              <b className="mr-0.5 font-semibold text-[20px] text-foreground">
                {Math.round(observation.humidityPct)}
              </b>
              %
            </p>
          ) : null}
          {observation.windSpeedMs !== null ? (
            <p>
              <b className="mr-0.5 font-semibold text-[20px] text-foreground">
                {observation.windDirectionLabel ?? ""} {observation.windSpeedMs.toFixed(0)}
              </b>
              m/s
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[11.5px] tabular-nums">
          <thead>
            <tr>
              <th className="px-3.5 py-1.5 text-left font-medium text-[11px] text-muted-foreground">
                時刻
              </th>
              {hours.map((hour) => (
                <th
                  key={hour.timeMs}
                  className="border-border border-t px-1 py-1.5 text-center font-medium text-muted-foreground"
                >
                  {formatClockShort(hour.timeMs)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.key}>
                <th className="whitespace-nowrap border-border border-t px-3.5 py-1.5 text-left font-normal text-[11px] text-muted-foreground">
                  {row.label}
                </th>
                {hours.map((hour) => (
                  <td key={hour.timeMs} className="border-border border-t px-1 py-1.5 text-center">
                    {row.key === "weather" ? hour.label : null}
                    {row.key === "temperature" ? Math.round(hour.temperatureC) : null}
                    {row.key === "humidity" ? Math.round(hour.humidityPct) : null}
                    {row.key === "precipitation" ? hour.precipitationMm.toFixed(1) : null}
                    {row.key === "wind"
                      ? `${hour.windDirectionLabel} ${Math.round(hour.windSpeedMs)}`
                      : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
