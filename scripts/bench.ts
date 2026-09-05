/** Measure one full recomputation, to size the replay poll interval. */
import { getRaceConfig } from "@/config/races";
import { computeSnapshot } from "@/lib/compute/snapshot";
import { buildNeighbourModel } from "@/lib/history/model";
import { buildNameIndex, type HistoryYear } from "@/lib/history/nameIndex";
import { loadFixtureSnapshot } from "@/lib/testing/fixtures";

const years: HistoryYear[] = [2023, 2024].map((year) => ({
  year,
  snapshot: loadFixtureSnapshot(year, Date.parse(`${year}-09-30T00:00:00+09:00`)),
  config: getRaceConfig(year),
}));
const config = getRaceConfig(2025);
const model = buildNeighbourModel(years, config);
const nameIndex = buildNameIndex(years);
const raw = loadFixtureSnapshot(2025, Date.now());

for (const label of ["10:00", "13:00", "17:00"]) {
  const now = Date.parse(`2025-09-07T${label}:00+09:00`);
  const visible = {
    ...raw,
    athletes: raw.athletes.map((a) => ({
      ...a,
      passes: Object.fromEntries(Object.entries(a.passes).filter(([, at]) => at <= now)),
    })),
  };
  const started = performance.now();
  const snapshot = computeSnapshot(visible, config, model, nameIndex, now);
  const ms = performance.now() - started;
  process.stdout.write(
    `${label}: ${ms.toFixed(0)} ms, ${snapshot.athletes.size} athletes, ` +
      `${[...snapshot.athletes.values()].filter((c) => c.prediction).length} predictions\n`,
  );
}
