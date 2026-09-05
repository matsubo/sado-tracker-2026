import { getRaceConfig } from "@/config/races";
import type { Division } from "@/config/races";
import type { BacktestAccuracy, BacktestTable } from "@/lib/compute/prediction";
import { predictFinish } from "@/lib/compute/prediction";
import { buildPopulations } from "@/lib/compute/population";
import type { Athlete } from "@/lib/domain/types";
import { logger } from "@/lib/runtime/logger";
import { buildNeighbourModel } from "./model";
import type { HistoryYear } from "./nameIndex";

const DIVISIONS: readonly Division[] = ["A", "B"];
const WITHIN_MS = 25 * 60_000;
/** Backtesting every finisher is slow and adds nothing; a sample suffices. */
const SAMPLE_STRIDE = 4;

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/**
 * Measure how well the neighbour method would have predicted one past race,
 * training only on the other years. The result is shown to readers so they
 * can judge how much to trust a live prediction.
 */
export function runBacktest(years: readonly HistoryYear[], holdoutYear: number): BacktestTable {
  const holdout = years.find((y) => y.year === holdoutYear);
  const training = years.filter((y) => y.year !== holdoutYear);
  const table = new Map<string, BacktestAccuracy>();
  if (!holdout || training.length === 0) return table;

  const config = getRaceConfig(holdoutYear);
  const model = buildNeighbourModel(training, config);
  const errorsByKey = new Map<string, number[]>();

  for (const division of DIVISIONS) {
    const course = config.divisions[division];
    const pop = buildPopulations(holdout.snapshot.athletes, division, course, holdout.snapshot.fetchedAt);
    const finishers = pop.atCheckpoint("finish");

    for (let i = 0; i < finishers.length; i += SAMPLE_STRIDE) {
      const athlete = finishers[i] as Athlete;
      const actualTotal = (athlete.passes.finish as number) - athlete.startAt;

      for (const checkpoint of course.checkpoints) {
        if (checkpoint.id === "start" || checkpoint.id === "finish") continue;
        const at = athlete.passes[checkpoint.id];
        if (at === undefined) continue;

        // Hide everything after this checkpoint, as if the race were live.
        const partial: Athlete = {
          ...athlete,
          passes: Object.fromEntries(
            Object.entries(athlete.passes).filter(([, time]) => time <= at),
          ),
        };

        const prediction = predictFinish(partial, course, pop, model, at + 1000);
        if (!prediction || prediction.method !== "neighbours") continue;

        const key = `${division}:${checkpoint.id}`;
        const errors = errorsByKey.get(key) ?? [];
        errors.push(Math.abs(prediction.totalMs - actualTotal));
        errorsByKey.set(key, errors);
      }
    }
  }

  for (const [key, errors] of errorsByKey) {
    if (errors.length < 20) continue;
    table.set(key, {
      medianErrorMs: median(errors),
      within25MinPct: (errors.filter((e) => e <= WITHIN_MS).length / errors.length) * 100,
      sampleSize: errors.length,
    });
  }

  logger.info("Backtest complete", { holdoutYear, keys: table.size });
  return table;
}
