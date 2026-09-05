import { readFileSync } from "node:fs";
import { getRaceConfig } from "@/config/races";
import { decodeCp932 } from "@/lib/csv/decode";
import { toSnapshot } from "@/lib/csv/normalize";
import { parseCsv } from "@/lib/csv/parse";
import type { RaceSnapshot } from "@/lib/domain/types";

/** Load an anonymized fixture export. Timestamps are the real ones. */
export function loadFixtureSnapshot(year: number, fetchedAt = Date.now()): RaceSnapshot {
  const path =
    year === 2026 ? "tests/fixtures/sample-2026.csv" : `tests/fixtures/history-${year}.csv`;
  const buffer = readFileSync(path);
  const text = decodeCp932(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  );
  return toSnapshot(parseCsv(text), getRaceConfig(year), fetchedAt);
}
