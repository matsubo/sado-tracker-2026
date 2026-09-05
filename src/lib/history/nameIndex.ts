import { type Division, normalizeName, type RaceConfig } from "@/config/races";
import { buildPopulations } from "@/lib/compute/population";
import { type Rank, rankBy } from "@/lib/compute/ranking";
import type { RaceSnapshot } from "@/lib/domain/types";

export interface PastResult {
  readonly year: number;
  readonly division: Division;
  readonly bib: string;
  /** FINISH minus START, in milliseconds. */
  readonly totalMs: number;
  /** The published 総合記録, when the year has that column. */
  readonly totalText: string | null;
  readonly divisionRank: Rank;
  readonly ageRank: Rank | null;
  readonly ageGroupId: string | null;
}

export interface HistoryYear {
  readonly year: number;
  readonly snapshot: RaceSnapshot;
  readonly config: RaceConfig;
}

export type NameIndex = Map<string, PastResult[]>;

const DIVISIONS: readonly Division[] = ["A", "B", "RA", "RB"];

/**
 * Index every past finisher by normalized name so a current athlete can be
 * matched across years. A name is not unique, so each key holds every
 * matching result and the UI shows them all.
 */
export function buildNameIndex(years: readonly HistoryYear[]): NameIndex {
  const index: NameIndex = new Map();

  for (const { year, snapshot, config } of years) {
    // Well after the race, so status is final and nobody counts as still racing.
    const after = snapshot.fetchedAt;

    for (const division of DIVISIONS) {
      const course = config.divisions[division];
      const pop = buildPopulations(snapshot.athletes, division, course, after);
      const finishers = pop.atCheckpoint("finish");
      const totalOf = (a: (typeof finishers)[number]) => (a.passes.finish as number) - a.startAt;

      for (const athlete of finishers) {
        const divisionRank = rankBy(finishers, totalOf, athlete);
        if (!divisionRank) continue;

        const ageGroup = athlete.ageGroup;
        const ageRank = ageGroup
          ? rankBy(pop.atCheckpointByAgeGroup("finish", ageGroup.id), totalOf, athlete)
          : null;

        const result: PastResult = {
          year,
          division,
          bib: athlete.bib,
          totalMs: totalOf(athlete),
          totalText: athlete.officialTotal,
          divisionRank,
          ageRank,
          ageGroupId: ageGroup?.id ?? null,
        };

        const existing = index.get(athlete.nameKey);
        if (existing) existing.push(result);
        else index.set(athlete.nameKey, [result]);
      }
    }
  }

  for (const results of index.values()) {
    results.sort((a, b) => b.year - a.year);
  }

  return index;
}

/** Past results for a name, newest first. Accepts either space spelling. */
export function findPastResults(index: NameIndex, name: string): PastResult[] {
  return index.get(normalizeName(name)) ?? [];
}
