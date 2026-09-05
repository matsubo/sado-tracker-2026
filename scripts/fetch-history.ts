/**
 * Download the result exports for past races into .data/history.
 * They hold real names, so they are never committed; see make-fixtures.ts
 * for the anonymized copies the tests use.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { getRaceConfig, HISTORY_YEARS } from "@/config/races";
import { fetchCsv } from "@/lib/csv/fetch";

const DIR = ".data/history";

async function main(): Promise<void> {
  mkdirSync(DIR, { recursive: true });
  for (const year of HISTORY_YEARS) {
    const { csvUrl } = getRaceConfig(year);
    const buffer = await fetchCsv(csvUrl);
    writeFileSync(`${DIR}/${year}.csv`, Buffer.from(buffer));
    process.stdout.write(`${year}: ${buffer.byteLength} bytes\n`);
  }
}

await main();
