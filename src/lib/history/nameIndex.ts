import { type Discipline, type Division, normalizeName, type RaceConfig } from "@/config/races";
import { disciplineKm, disciplineTime } from "@/lib/compute/elapsed";
import { buildPopulations } from "@/lib/compute/population";
import { disciplineRanks, type Rank, rankBy } from "@/lib/compute/ranking";
import type { RaceSnapshot } from "@/lib/domain/types";

/** One discipline of a past race, with the rank it earned that year. */
export interface PastDiscipline {
  readonly discipline: Discipline;
  readonly timeMs: number;
  /** Distance raced that year, which is not always the same across years. */
  readonly km: number;
  readonly divisionRank: Rank | null;
  readonly ageRank: Rank | null;
}

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
  /** Swim, bike and run of that race, for readers who want the breakdown. */
  readonly disciplines: readonly PastDiscipline[];
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

      const legs: readonly Discipline[] = ["swim", "bike", "run"];

      for (const athlete of finishers) {
        const divisionRank = rankBy(finishers, totalOf, athlete);
        if (!divisionRank) continue;

        const disciplines: PastDiscipline[] = [];
        for (const leg of legs) {
          const timeMs = disciplineTime(athlete, leg, course);
          if (timeMs === null) continue;
          const ranked = disciplineRanks(athlete, leg, pop, course);
          disciplines.push({
            discipline: leg,
            timeMs,
            km: disciplineKm(leg, course),
            divisionRank: ranked.ranks.division,
            ageRank: ranked.ranks.ageGroup,
          });
        }

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
          disciplines,
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
