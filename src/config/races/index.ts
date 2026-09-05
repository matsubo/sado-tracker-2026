import type { Division, RaceConfig } from "../types";
import { race2022 } from "./2022";
import { race2023 } from "./2023";
import { race2024 } from "./2024";
import { race2025 } from "./2025";
import { race2026 } from "./2026";

const CONFIGS: readonly RaceConfig[] = [race2022, race2023, race2024, race2025, race2026];

const BY_YEAR = new Map(CONFIGS.map((c) => [c.year, c]));

/** Years that can be loaded as history, oldest first. */
export const HISTORY_YEARS = [2022, 2023, 2024, 2025] as const;

export function getRaceConfig(year: number): RaceConfig {
  const config = BY_YEAR.get(year);
  if (!config) {
    throw new Error(`No race configuration for year ${year}`);
  }
  return config;
}

/**
 * Map a raw 部門 label to a division. Returns null when the row must be
 * dropped: reserve entries, blank divisions and anything unrecognised.
 */
export function normalizeDivision(raw: string, config: RaceConfig): Division | null {
  const text = raw.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (text === "") return null;
  const direct = config.divisionAliases[text];
  if (direct !== undefined) return direct;
  const original = raw.trim();
  const byOriginal = config.divisionAliases[original];
  return byOriginal === undefined ? null : byOriginal;
}

/** The source separates family and given name with a full-width space. */
export function normalizeName(raw: string): string {
  return raw.replace(/　/g, " ").replace(/\s+/g, " ").trim();
}

export type { AgeGroup, Sex } from "../ageGroup";
export { compareAgeGroups, normalizeAgeGroup } from "../ageGroup";
export type { CheckpointDef, Discipline, Division, DivisionCourse, RaceConfig } from "../types";
