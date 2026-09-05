/**
 * Generate the hand-crafted CSV fixture used by the parser tests.
 * The layout mirrors the 2026 export: every timing column is followed by an
 * `ms` column, headers are half-width katakana, and the file is Shift_JIS.
 * Names are invented; no real athlete appears in this repository.
 */
import { writeFileSync } from "node:fs";

const HEADERS = [
  '"No."', '"名前"', '"性別"', '"部門"', '"年齢区分"',
  "受付", "ms", "競技説明会", "ms", "入水", "ms", '"START"',
  "ｽｲﾑL", "ms", "ｽｲﾑF", "ms", "ﾊﾞｲｸS", "ms", "住吉", "ms", "ﾗﾝS（本部）", "ms",
  "ﾗﾝ4km", "ms", "ﾗﾝ9km", "ms", "ﾗﾝ10km", "ms", "ﾗﾝ14km", "ms", "ﾗﾝ19km", "ms",
  "ﾗﾝ20km", "ms", "ﾗﾝ24km", "ms", "ﾗﾝ29km", "ms", "ﾗﾝ30km", "ms",
  "ﾗﾝ34km", "ms", "ﾗﾝ39km", "ms", "FINISH", "ms", '"総合記録"', '"備考"',
];

interface Row {
  bib: string; name: string; sex: string; division: string; age: string;
  reception?: string; briefing?: string; waterEntry?: string; start?: string;
  passes?: Record<string, [string, string]>;
  total?: string; remark?: string;
}

const D = "2026/09/06";

const ROWS: Row[] = [
  // A finisher with every checkpoint
  {
    bib: "1001", name: "佐和田　蓮", sex: "男", division: "Aタイプ", age: "30-34歳男子",
    reception: `2026/09/05 11:54:07`, briefing: `2026/09/05 13:00:00`, waterEntry: `${D} 05:40:00`,
    start: `${D} 06:00:00`,
    passes: {
      "ｽｲﾑL": [`${D} 06:40:00`, "120"], "ｽｲﾑF": [`${D} 07:20:30`, "450"],
      "ﾊﾞｲｸS": [`${D} 07:28:00`, "000"], 住吉: [`${D} 11:20:00`, "300"],
      "ﾗﾝS（本部）": [`${D} 14:56:00`, "000"], "ﾗﾝ4km": [`${D} 15:18:00`, "000"],
      "ﾗﾝ39km": [`${D} 19:40:00`, "000"], FINISH: [`${D} 19:58:30`, "110"],
    },
    total: "13:58:30",
  },
  // A athlete mid-bike, past 住吉 only
  {
    bib: "1002", name: "両津　美咲", sex: "女", division: "Aタイプ", age: "45-49歳女子",
    waterEntry: `${D} 05:42:00`, start: `${D} 06:00:00`,
    passes: {
      "ｽｲﾑL": [`${D} 06:41:12`, "000"], "ｽｲﾑF": [`${D} 07:23:45`, "000"],
      "ﾊﾞｲｸS": [`${D} 07:31:57`, "000"], 住吉: [`${D} 10:12:34`, "000"],
    },
  },
  // A athlete who entered the water but has no swim split: still racing
  {
    bib: "1003", name: "赤泊　悠人", sex: "男", division: "Aタイプ", age: "50-54歳男子",
    waterEntry: `${D} 05:45:00`, start: `${D} 06:00:00`,
  },
  // A athlete with no water entry and no splits: not started
  {
    bib: "1004", name: "羽茂　樹", sex: "男", division: "Aタイプ", age: "55-59歳男子",
    reception: `2026/09/05 10:00:00`, start: `${D} 06:00:00`,
  },
  // A athlete who abandoned after 住吉
  {
    bib: "1005", name: "小木　健", sex: "男", division: "Aタイプ", age: "40-44歳男子",
    waterEntry: `${D} 05:44:00`, start: `${D} 06:00:00`,
    passes: {
      "ｽｲﾑF": [`${D} 07:30:00`, "000"], "ﾊﾞｲｸS": [`${D} 07:38:00`, "000"],
      住吉: [`${D} 11:50:00`, "000"],
    },
    remark: "DNF/本部(20:24)",
  },
  // B finisher; note the B course has no swim lap and stops at ラン19km
  {
    bib: "3001", name: "相川　陽介", sex: "男", division: "Bタイプ", age: "35-39歳男子",
    waterEntry: `${D} 07:10:00`, start: `${D} 07:30:00`,
    passes: {
      "ｽｲﾑF": [`${D} 07:54:55`, "670"], "ﾊﾞｲｸS": [`${D} 08:03:00`, "000"],
      住吉: [`${D} 08:47:00`, "000"], "ﾗﾝS（本部）": [`${D} 11:34:00`, "000"],
      "ﾗﾝ4km": [`${D} 11:52:00`, "000"], "ﾗﾝ19km": [`${D} 12:56:00`, "000"],
      FINISH: [`${D} 13:04:22`, "190"],
    },
    total: "5:34:22",
  },
  // B athlete mid-run
  {
    bib: "3002", name: "畑野　遥", sex: "女", division: "Bタイプ", age: "40-44歳女子",
    waterEntry: `${D} 07:12:00`, start: `${D} 07:30:00`,
    passes: {
      "ｽｲﾑF": [`${D} 08:00:00`, "000"], "ﾊﾞｲｸS": [`${D} 08:08:00`, "000"],
      住吉: [`${D} 08:55:00`, "000"], "ﾗﾝS（本部）": [`${D} 12:00:00`, "000"],
      "ﾗﾝ4km": [`${D} 12:22:00`, "000"], "ﾗﾝ14km": [`${D} 13:10:00`, "000"],
    },
  },
  // Two athletes tied on swim, to exercise competition ranking
  {
    bib: "3003", name: "金井　陸", sex: "男", division: "Bタイプ", age: "25-29歳男子",
    waterEntry: `${D} 07:11:00`, start: `${D} 07:30:00`,
    passes: { "ｽｲﾑF": [`${D} 07:54:55`, "670"], "ﾊﾞｲｸS": [`${D} 08:04:00`, "000"] },
  },
  // Relay entry: no sex, no age group
  {
    bib: "5001", name: "新穂　碧", sex: "", division: "RBタイプ", age: "",
    waterEntry: `${D} 07:13:00`, start: `${D} 07:30:00`,
    passes: { "ｽｲﾑF": [`${D} 08:05:00`, "000"], "ﾊﾞｲｸS": [`${D} 08:12:00`, "000"] },
  },
  // Reserve entry: must be dropped
  { bib: "9001", name: "予備　太郎", sex: "男", division: "予備", age: "40-44歳男子" },
  // Empty division: must be dropped
  { bib: "9002", name: "欠番　次郎", sex: "男", division: "", age: "40-44歳男子" },
  // Missing START: must fall back to the wave start from config
  {
    bib: "1006", name: "真野　湊", sex: "男", division: "Aタイプ", age: "60-64歳男子",
    waterEntry: `${D} 05:50:00`,
    passes: { "ｽｲﾑF": [`${D} 07:40:00`, "000"] },
  },
];

function cell(value: string | undefined): string {
  return value ?? "";
}

function toLine(row: Row): string {
  const p = row.passes ?? {};
  const pass = (key: string): [string, string] => p[key] ?? ["", ""];
  const cols: string[] = [
    row.bib, row.name, row.sex, row.division, row.age,
    cell(row.reception), row.reception ? "038" : "",
    cell(row.briefing), row.briefing ? "000" : "",
    cell(row.waterEntry), row.waterEntry ? "820" : "",
    cell(row.start),
  ];
  for (const key of [
    "ｽｲﾑL", "ｽｲﾑF", "ﾊﾞｲｸS", "住吉", "ﾗﾝS（本部）", "ﾗﾝ4km", "ﾗﾝ9km", "ﾗﾝ10km",
    "ﾗﾝ14km", "ﾗﾝ19km", "ﾗﾝ20km", "ﾗﾝ24km", "ﾗﾝ29km", "ﾗﾝ30km", "ﾗﾝ34km",
    "ﾗﾝ39km", "FINISH",
  ]) {
    const [time, ms] = pass(key);
    cols.push(time, ms);
  }
  cols.push(cell(row.total), cell(row.remark));
  return cols.join(",");
}

const text = [HEADERS.join(","), ...ROWS.map(toLine)].join("\r\n");
const encoded = new (await import("node:util")).TextEncoder();
void encoded;
// Node has no Shift_JIS encoder, so shell out to iconv via a UTF-8 temp file.
writeFileSync("tests/fixtures/sample-2026.utf8.csv", `${text}\r\n`, "utf8");
process.stdout.write(`${ROWS.length} rows written\n`);
