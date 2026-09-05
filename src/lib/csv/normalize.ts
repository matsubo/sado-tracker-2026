import {
  normalizeAgeGroup,
  normalizeDivision,
  normalizeName,
  type RaceConfig,
  type Sex,
} from "@/config/races";
import type { Athlete, PreRacePasses, RaceSnapshot } from "@/lib/domain/types";
import { logOnce } from "@/lib/runtime/logger";
import { type ColumnMap, mapHeaders } from "./headers";
import { parseJstTimestamp, waveStartToEpoch } from "./time";

const SEX_BY_LABEL: Record<string, Sex> = { 男: "M", 女: "F", M: "M", F: "F" };

function cell(row: readonly string[], index: number): string {
  return index >= 0 ? (row[index] ?? "").trim() : "";
}

function readTimestamp(row: readonly string[], index: number, msIndex: number | null): number | null {
  const text = cell(row, index);
  if (text === "") return null;
  return parseJstTimestamp(text, msIndex === null ? "" : cell(row, msIndex));
}

function toAthlete(
  row: readonly string[],
  map: ColumnMap,
  config: RaceConfig,
): Athlete | null {
  const bib = cell(row, map.bib);
  if (bib === "") return null;

  const division = normalizeDivision(cell(row, map.division), config);
  if (division === null) return null;

  const rawName = row[map.name] ?? "";
  const passes: Record<string, number> = {};
  for (const column of map.timing) {
    const value = readTimestamp(row, column.index, column.msIndex);
    if (value !== null) passes[column.checkpointId] = value;
  }

  const preRace: Record<string, number> = {};
  for (const column of map.preRace) {
    const value = readTimestamp(row, column.index, column.msIndex);
    if (value !== null) preRace[column.checkpointId] = value;
  }

  const declaredStart = map.start === null ? null : readTimestamp(row, map.start, null);
  const startAt =
    declaredStart ?? waveStartToEpoch(config.raceDate, config.divisions[division].waveStart);

  if (declaredStart === null && map.start !== null && cell(row, map.start) !== "") {
    logOnce(`start:${config.year}:${bib}`, "Unparsable START, using the wave start", {
      year: config.year,
      bib,
      value: cell(row, map.start),
    });
  }

  return {
    bib,
    name: rawName.trim(),
    nameKey: normalizeName(rawName),
    sex: SEX_BY_LABEL[cell(row, map.sex)] ?? null,
    division,
    ageGroup: normalizeAgeGroup(cell(row, map.ageGroup)),
    startAt,
    startInferred: declaredStart === null,
    passes,
    preRace: preRace as PreRacePasses,
    officialTotal: map.total === null ? null : cell(row, map.total) || null,
    remark: map.remark === null ? "" : cell(row, map.remark),
  };
}

/**
 * Turn the raw CSV grid into a snapshot. Reserve entries, blank divisions and
 * rows without a bib are dropped; a duplicate bib is a hard error, because
 * every lookup in the app is keyed by bib.
 */
export function toSnapshot(
  rows: readonly (readonly string[])[],
  config: RaceConfig,
  fetchedAt: number,
): RaceSnapshot {
  const [header, ...body] = rows;
  if (!header) {
    throw new Error("CSV has no header row");
  }

  const map = mapHeaders(header, config);
  const athletes: Athlete[] = [];
  const seen = new Set<string>();

  for (const row of body) {
    const athlete = toAthlete(row, map, config);
    if (!athlete) continue;
    if (seen.has(athlete.bib)) {
      throw new Error(`Duplicate bib ${athlete.bib} in the ${config.year} export`);
    }
    seen.add(athlete.bib);
    athletes.push(athlete);
  }

  return { year: config.year, fetchedAt, athletes };
}
