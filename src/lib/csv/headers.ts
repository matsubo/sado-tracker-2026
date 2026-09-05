import type { Division, RaceConfig } from "@/config/races";
import { logOnce } from "@/lib/runtime/logger";

/** A timing column and the index of the `ms` column that follows it. */
export interface TimingColumn {
  readonly checkpointId: string;
  readonly index: number;
  readonly msIndex: number | null;
}

export interface ColumnMap {
  readonly bib: number;
  readonly name: number;
  readonly sex: number;
  readonly division: number;
  readonly ageGroup: number;
  readonly start: number | null;
  readonly total: number | null;
  readonly remark: number | null;
  /** Race checkpoints, keyed by checkpoint id, shared across divisions. */
  readonly timing: readonly TimingColumn[];
  /** Registration, briefing and water entry columns. */
  readonly preRace: readonly TimingColumn[];
}

const PRE_RACE_HEADERS: Record<string, string> = {
  受付: "reception",
  競技説明会: "briefing",
  入水: "waterEntry",
};

const BIB_HEADERS = ["No.", "ﾅﾝﾊﾞｰ", "ナンバー"];
const SEX_HEADERS = ["性別"];
const DIVISION_HEADERS = ["部門"];
const AGE_HEADERS = ["年齢区分"];
const START_HEADERS = ["START", "ｽﾀｰﾄ"];
const REMARK_HEADERS = ["備考"];

function findIndex(header: readonly string[], candidates: readonly string[]): number | null {
  for (const candidate of candidates) {
    const index = header.indexOf(candidate);
    if (index >= 0) return index;
  }
  return null;
}

/**
 * Build a checkpoint-id lookup covering every division of the year, because
 * one CSV holds all of them and the column set is the union of their courses.
 */
function checkpointIdByHeader(config: RaceConfig): Map<string, string> {
  const map = new Map<string, string>();
  const divisions: Division[] = ["A", "RA", "B", "RB"];
  for (const division of divisions) {
    for (const checkpoint of config.divisions[division].checkpoints) {
      if (checkpoint.id === "start") continue;
      for (const header of checkpoint.csvHeaders) {
        map.set(header, checkpoint.id);
      }
    }
  }
  return map;
}

/**
 * Map the header row to column indexes. Every timing column is followed by an
 * `ms` column holding the fractional part, so the pair is resolved here once
 * rather than at every row.
 */
export function mapHeaders(header: readonly string[], config: RaceConfig): ColumnMap {
  const byHeader = checkpointIdByHeader(config);
  const timing: TimingColumn[] = [];
  const preRace: TimingColumn[] = [];
  const seen = new Set<string>();

  header.forEach((raw, index) => {
    const name = raw.trim();
    if (name === "" || name === "ms") return;

    const msIndex = header[index + 1]?.trim() === "ms" ? index + 1 : null;

    const preRaceId = PRE_RACE_HEADERS[name];
    if (preRaceId) {
      preRace.push({ checkpointId: preRaceId, index, msIndex });
      return;
    }

    const checkpointId = byHeader.get(name);
    if (checkpointId) {
      if (seen.has(checkpointId)) return;
      seen.add(checkpointId);
      timing.push({ checkpointId, index, msIndex });
      return;
    }

    if (
      !BIB_HEADERS.includes(name) &&
      !SEX_HEADERS.includes(name) &&
      !DIVISION_HEADERS.includes(name) &&
      !AGE_HEADERS.includes(name) &&
      !START_HEADERS.includes(name) &&
      !REMARK_HEADERS.includes(name) &&
      !config.nameHeaders.includes(name) &&
      !config.totalHeaders.includes(name)
    ) {
      logOnce(`header:${config.year}:${name}`, "Ignoring unknown CSV column", {
        year: config.year,
        column: name,
      });
    }
  });

  const bib = findIndex(header, BIB_HEADERS);
  const name = findIndex(header, config.nameHeaders);
  if (bib === null || name === null) {
    throw new Error(`CSV header is missing the bib or name column (year ${config.year})`);
  }

  return {
    bib,
    name,
    sex: findIndex(header, SEX_HEADERS) ?? -1,
    division: findIndex(header, DIVISION_HEADERS) ?? -1,
    ageGroup: findIndex(header, AGE_HEADERS) ?? -1,
    start: findIndex(header, START_HEADERS),
    total: findIndex(header, config.totalHeaders),
    remark: findIndex(header, REMARK_HEADERS),
    timing,
    preRace,
  };
}
