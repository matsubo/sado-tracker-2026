import type { PredictionDto } from "@/lib/api/contract";
import { formatClockShort, formatDurationShort } from "@/lib/format";

/** The compact prediction shown on a friend card; the detail page explains it. */
export function PredictionSummary({ prediction }: { prediction: PredictionDto | null }) {
  if (!prediction) {
    return (
      <p className="rounded-lg bg-muted px-2.5 py-2 text-[12px] text-muted-foreground">
        予想ゴールは最初の計測点を通過してから表示されます。
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-muted px-2.5 py-2">
      <div>
        <p className="font-bold text-[11px] text-muted-foreground">予想ゴール</p>
        <p className="font-bold text-[22px] leading-none tabular-nums">
          {formatClockShort(prediction.finishAt)}
        </p>
      </div>
      <p className="text-[11.5px] text-muted-foreground leading-tight tabular-nums">
        総合 {formatDurationShort(prediction.totalMs)} 前後
        <br />
        幅 {formatClockShort(prediction.rangeLowMs + (prediction.finishAt - prediction.totalMs))}〜
        {formatClockShort(prediction.rangeHighMs + (prediction.finishAt - prediction.totalMs))}
        {prediction.method === "neighbours"
          ? ` · 近傍 ${prediction.explanation.neighbourCount} 人`
          : " · 概算"}
      </p>
    </div>
  );
}
