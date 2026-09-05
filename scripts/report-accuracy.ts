/** Print the backtest accuracy table, for the record. */
import { getRaceConfig } from "@/config/races";
import { runBacktest } from "@/lib/history/backtest";
import type { HistoryYear } from "@/lib/history/nameIndex";
import { raceYear } from "@/lib/runtime/year";
import { loadFixtureSnapshot } from "@/lib/testing/fixtures";

const years: HistoryYear[] = [2023, 2024, 2025].map((year) => ({
  year,
  snapshot: loadFixtureSnapshot(year, Date.parse(`${year}-09-30T00:00:00+09:00`)),
  config: getRaceConfig(year),
}));

// Report what the edition being served would actually show.
const table = runBacktest(years, 2025, getRaceConfig(raceYear()));
const rows = [...table.entries()].sort(([a], [b]) => a.localeCompare(b));
process.stdout.write("division:checkpoint  median error  within 25min  n\n");
for (const [key, value] of rows) {
  const minutes = (value.medianErrorMs / 60000).toFixed(1).padStart(6);
  const pct = value.within25MinPct.toFixed(0).padStart(4);
  process.stdout.write(`${key.padEnd(20)} ${minutes} min      ${pct}%     ${value.sampleSize}\n`);
}
