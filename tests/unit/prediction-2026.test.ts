import { describe, expect, it } from "vitest";
import { getRaceConfig } from "@/config/races";
import { buildPopulations } from "@/lib/compute/population";
import { predictFinish } from "@/lib/compute/prediction";
import type { Athlete } from "@/lib/domain/types";
import { runBacktest } from "@/lib/history/backtest";
import { buildNeighbourModel } from "@/lib/history/model";
import type { HistoryYear } from "@/lib/history/nameIndex";
import { loadFixtureSnapshot } from "@/lib/testing/fixtures";

/**
 * The organiser halved the 2026 swim on the morning of the race. These tests
 * hold the finish prediction to account for it: the swim can no longer be
 * compared with earlier years, and the bike and run must be untouched.
 */
const years: HistoryYear[] = [2023, 2024, 2025].map((year) => ({
  year,
  snapshot: loadFixtureSnapshot(year, Date.parse(`${year}-09-30T00:00:00+09:00`)),
  config: getRaceConfig(year),
}));

const live = getRaceConfig(2026);
const model = buildNeighbourModel(years, live);
const holdout = loadFixtureSnapshot(2025, Date.parse("2025-09-30T00:00:00+09:00"));
const course2025 = getRaceConfig(2025).divisions.A;
const pop = buildPopulations(holdout.athletes, "A", course2025, holdout.fetchedAt);

/** The athlete as they were at one checkpoint, with the rest of the race hidden. */
function asOf(athlete: Athlete, checkpointId: string): { partial: Athlete; at: number } | null {
  const at = athlete.passes[checkpointId];
  if (at === undefined) return null;
  return {
    at,
    partial: {
      ...athlete,
      passes: Object.fromEntries(
        Object.entries(athlete.passes).filter(([, time]) => (time as number) <= at),
      ),
    },
  };
}

function methodsAt(checkpointId: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const athlete of pop.atCheckpoint(checkpointId).slice(0, 60)) {
    const state = asOf(athlete, checkpointId);
    if (!state) continue;
    const prediction = predictFinish(state.partial, course2025, pop, model, state.at + 1000);
    const method = prediction?.method ?? "none";
    counts[method] = (counts[method] ?? 0) + 1;
  }
  return counts;
}

describe("the 2026 model still predicts a finish", () => {
  it("scores the A swim by within-year rank, not against a 4 km swim", () => {
    expect(model.features.A).toEqual(["bike", "run"]);
    expect(model.percentileFeatures.A).toEqual(["swim"]);
  });

  it("produces a prediction at every checkpoint on the course", () => {
    for (const checkpoint of course2025.checkpoints) {
      if (checkpoint.id === "start" || checkpoint.id === "finish") continue;
      const sample = pop.atCheckpoint(checkpoint.id).slice(0, 20);
      if (sample.length === 0) continue;
      let predicted = 0;
      for (const athlete of sample) {
        const state = asOf(athlete, checkpoint.id);
        if (!state) continue;
        if (predictFinish(state.partial, course2025, pop, model, state.at + 1000)) predicted += 1;
      }
      expect(predicted, `no prediction at ${checkpoint.id}`).toBe(sample.length);
    }
  });

  it("uses neighbours once the swim is finished", () => {
    expect(methodsAt("swimF").neighbours).toBe(60);
    expect(methodsAt("bikeS").neighbours).toBe(60);
  });

  it("falls back to extrapolation mid-swim, and says so", () => {
    // A rank among swimmers still in the water is not a finished swim, so
    // there is nobody comparable to borrow a finish time from. Naming the
    // method matters more than producing a confident number this early.
    expect(methodsAt("swimL")).toEqual({ extrapolation: 60 });
  });
});

describe("accuracy is measured on the model that is actually running", () => {
  const table = runBacktest(years, 2025, live);

  it("keeps the run predictions as sharp as before the swim changed", () => {
    const run30 = table.get("A:run30");
    expect(run30).toBeDefined();
    expect((run30 as { medianErrorMs: number }).medianErrorMs).toBeLessThan(6 * 60_000);
    const run34 = table.get("A:run34");
    expect((run34 as { medianErrorMs: number }).medianErrorMs).toBeLessThan(4 * 60_000);
  });

  it("keeps the bike predictions within half an hour at 住吉", () => {
    const sumiyoshi = table.get("A:sumiyoshi");
    expect(sumiyoshi).toBeDefined();
    expect((sumiyoshi as { medianErrorMs: number }).medianErrorMs).toBeLessThan(30 * 60_000);
  });

  it("reports no accuracy for a point where the live model would not use neighbours", () => {
    expect(table.has("A:swimL")).toBe(false);
  });
});
