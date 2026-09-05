/**
 * Build anonymized fixtures from the downloaded exports. Every timestamp,
 * division and age group is preserved so the reference checks stay
 * meaningful, but names are replaced with generated ones and bibs are
 * remapped, so no real athlete appears in this public repository.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { getRaceConfig } from "@/config/races";
import { decodeCp932 } from "@/lib/csv/decode";
import { parseCsv } from "@/lib/csv/parse";

const SOURCE_DIR = ".data/history";
const OUT_DIR = "tests/fixtures";
const YEARS = [2023, 2024, 2025] as const;

const FAMILY = [
  "佐和田", "両津", "相川", "小木", "羽茂", "真野", "畑野", "金井", "新穂", "赤泊",
  "沢根", "水津", "住吉", "多田", "松ケ崎", "岩首", "野浦", "月布施", "北狄", "達者",
];
const GIVEN_M = ["蓮", "湊", "陸", "樹", "悠人", "大和", "陽介", "健", "碧", "凪"];
const GIVEN_F = ["美咲", "遥", "澪", "楓", "千夏", "結衣", "紗希", "沙耶", "葵", "詩"];

/** Deterministic pseudo-random generator so fixtures are reproducible. */
function makeRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });

  for (const year of YEARS) {
    const path = `${SOURCE_DIR}/${year}.csv`;
    if (!existsSync(path)) {
      process.stdout.write(`${year}: source missing, run fetch-history first\n`);
      continue;
    }

    const buffer = readFileSync(path);
    const text = decodeCp932(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    );
    const rows = parseCsv(text);
    const header = rows[0];
    if (!header) throw new Error(`${year}: empty export`);

    const config = getRaceConfig(year);
    const nameIndex = config.nameHeaders
      .map((h) => header.indexOf(h))
      .find((index) => index >= 0);
    const sexIndex = header.indexOf("性別");
    const bibIndex = header.indexOf("No.");
    if (nameIndex === undefined || bibIndex < 0) throw new Error(`${year}: missing columns`);

    const random = makeRandom(year);
    const anonymized = rows.map((row, rowIndex) => {
      if (rowIndex === 0) return row;
      const copy = [...row];
      const female = (row[sexIndex] ?? "") === "女";
      const given = female ? GIVEN_F : GIVEN_M;
      const family = FAMILY[Math.floor(random() * FAMILY.length)] as string;
      const name = given[Math.floor(random() * given.length)] as string;
      copy[nameIndex] = `${family}　${name}`;
      copy[bibIndex] = String(90000 + rowIndex);
      return copy;
    });

    const csv = anonymized
      .map((row) => row.map((cell) => (cell.includes(",") ? `"${cell}"` : cell)).join(","))
      .join("\r\n");
    writeFileSync(`${OUT_DIR}/history-${year}.utf8.csv`, `${csv}\r\n`, "utf8");
    process.stdout.write(`${year}: ${anonymized.length - 1} rows anonymized\n`);
  }
}

main();
