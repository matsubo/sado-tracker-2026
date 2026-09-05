"use client";

import { useId, useState } from "react";
import type { PredictionDto } from "@/lib/api/contract";
import {
  formatClockShort,
  formatDuration,
  formatDurationShort,
  formatSpeedKmh,
} from "@/lib/format";

/** One row of the explanation list. A null value drops the row entirely. */
interface Row {
  readonly term: string;
  readonly value: string;
}

/** Renders the year histogram as "2025: 9 人 · 2024: 6 人", newest first. */
function yearBreakdownText(breakdown: Readonly<Record<string, number>>): string | null {
  const entries = Object.entries(breakdown).sort(([a], [b]) => Number(b) - Number(a));
  if (entries.length === 0) return null;
  return entries.map(([year, count]) => `${year}: ${count} 人`).join(" · ");
}

/** The athlete's own speed against the median of the neighbours used. */
function ownSpeedText(explanation: PredictionDto["explanation"]): string | null {
  const { ownSpeedKmh, neighbourSpeedKmh } = explanation;
  if (ownSpeedKmh === null) return null;
  const own = formatSpeedKmh(ownSpeedKmh);
  if (neighbourSpeedKmh === null) return own;
  return `${own}（近傍中央値 ${formatSpeedKmh(neighbourSpeedKmh)}）`;
}

/** The backtest line, present only when the model has been scored. */
function backtestText(explanation: PredictionDto["explanation"]): string | null {
  const { backtestMedianErrorMs, backtestWithin25MinPct } = explanation;
  if (backtestMedianErrorMs === null || backtestWithin25MinPct === null) return null;
  const minutes = Math.round(backtestMedianErrorMs / 60_000);
  return `中央値 ${minutes} 分 · ${Math.round(backtestWithin25MinPct)}% が ±25 分以内`;
}

/** Builds the definition list, skipping every value the server could not fill. */
function explanationRows(prediction: PredictionDto, startAt: number): readonly Row[] {
  const e = prediction.explanation;
  const candidates: readonly (Row | null)[] = [
    {
      term: "近傍の残り時間",
      value: `25% ${formatDurationShort(e.remainingP25Ms)} · 中央値 ${formatDurationShort(
        e.remainingMedianMs,
      )} · 75% ${formatDurationShort(e.remainingP75Ms)}`,
    },
    ownSpeedText(e) === null
      ? null
      : { term: "本人の直近区間", value: ownSpeedText(e) as string },
    yearBreakdownText(e.yearBreakdown) === null
      ? null
      : { term: "近傍の年内訳", value: yearBreakdownText(e.yearBreakdown) as string },
    e.extrapolationMs === null
      ? null
      : { term: "単純外挿なら", value: formatClockShort(startAt + e.extrapolationMs) },
    backtestText(e) === null ? null : { term: "この方法の実績", value: backtestText(e) as string },
  ];
  return candidates.filter((row): row is Row => row !== null);
}

interface PredictionBoxProps {
  readonly prediction: PredictionDto;
  /** Wave start, needed to turn the predicted durations back into clock times. */
  readonly startAt: number;
}

/**
 * Predicted finish, with the reasoning folded away behind a "?" button.
 *
 * Supporters want the number; the few who distrust it want the whole method,
 * so the explanation is complete but collapsed by default.
 */
export function PredictionBox({ prediction, startAt }: PredictionBoxProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const methodName =
    prediction.method === "neighbours"
      ? `近傍 ${prediction.explanation.neighbourCount} 人法`
      : "単純外挿";

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-end gap-3 px-3.5 py-3">
        <div className="font-bold text-[32px] leading-none tracking-tight tnum">
          {formatClockShort(prediction.finishAt)}
          <span className="ml-1 font-medium text-[14px] text-muted-foreground">頃</span>
        </div>
        <div className="text-[12px] text-muted-foreground leading-snug tnum">
          総合 <b className="font-semibold text-foreground">{formatDuration(prediction.totalMs)}</b> 前後
          <br />幅{" "}
          <b className="font-semibold text-foreground">
            {formatClockShort(startAt + prediction.rangeLowMs)}〜
            {formatClockShort(startAt + prediction.rangeHighMs)}
          </b>
          （25〜75%）
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label="予想ゴールの計算方法を表示"
          onClick={() => setOpen((current) => !current)}
          className="ml-auto size-[26px] shrink-0 self-start rounded-full border border-border bg-card font-semibold text-[13px] text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
        >
          ?
        </button>
      </div>
      {open ? (
        <div
          id={panelId}
          className="border-border border-t bg-muted px-3.5 py-2.5 text-[12px] text-muted-foreground"
        >
          <div className="mb-1.5 flex justify-between font-bold text-[12.5px] text-foreground">
            <span>どう計算したか</span>
            <span className="font-medium text-muted-foreground">{methodName}</span>
          </div>
          <p className="mb-2 leading-relaxed">
            {prediction.method === "neighbours" ? (
              <>
                過去の完走者から、{prediction.atCheckpointLabel} までの走り方が近い{" "}
                {prediction.explanation.neighbourCount} 人を選び、その {prediction.atCheckpointLabel}{" "}
                からゴールまでの所要時間の中央値{" "}
                <b className="font-semibold text-foreground">
                  {formatDuration(prediction.explanation.remainingMedianMs)}
                </b>{" "}
                を、いまの経過時間に足しました。
              </>
            ) : (
              <>
                {prediction.atCheckpointLabel} までの平均速度のまま残りの距離を進んだとして計算しました。
                近傍にできる過去の完走者が足りないため、中央値{" "}
                <b className="font-semibold text-foreground">
                  {formatDuration(prediction.explanation.remainingMedianMs)}
                </b>{" "}
                は参考値です。
              </>
            )}
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-1 tnum">
            {explanationRows(prediction, startAt).map((row) => (
              <div key={row.term} className="contents">
                <dt className="text-muted-foreground">{row.term}</dt>
                <dd className="m-0 font-semibold text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-[11.5px] leading-relaxed">{prediction.explanation.note}</p>
        </div>
      ) : null}
    </div>
  );
}
