import type { Discipline } from "@/config/races";
import type { Athlete } from "@/lib/domain/types";
import { disciplineEnd, disciplineStart, splitBetween } from "./elapsed";
import type { Populations } from "./population";

/** The three legs plus the whole race. */
export type RankingDiscipline = Discipline | "total";

export const RANKING_DISCIPLINES = [
  "swim",
  "bike",
  "run",
  "total",
] as const satisfies readonly RankingDiscipline[];

/** One row of a finished-discipline table, ready to be sliced into a page. */
interface RankedEntry {
  readonly bib: string;
  readonly name: string;
  readonly ageGroupId: string | null;
  readonly timeMs: number;
  /** Standard competition rank within the whole division. */
  readonly rank: number;
}

export type RankingTables = Readonly<Record<RankingDiscipline, readonly RankedEntry[]>>;

/** The checkpoint an athlete must have passed to appear in a table. */
export function rankingEnd(discipline: RankingDiscipline): string {
  return discipline === "total" ? "finish" : disciplineEnd(discipline);
}

/** The time a table is ordered on, or null when the athlete has not completed it. */
function rankingTime(athlete: Athlete, discipline: RankingDiscipline): number | null {
  if (discipline === "total") return splitBetween(athlete, "start", "finish");
  return splitBetween(athlete, disciplineStart(discipline), disciplineEnd(discipline));
}

/**
 * Standard competition ranks for times already sorted ascending: ties share
 * a rank and the following rank skips, so 10, 20, 20, 30 rank 1, 2, 2, 4.
 * One pass, so a thousand-row table costs a thousand comparisons rather than
 * a million.
 */
export function competitionRanks(sortedTimes: readonly number[]): number[] {
  const ranks: number[] = [];
  let rank = 0;
  let previous = Number.NaN;
  sortedTimes.forEach((time, index) => {
    if (time !== previous) {
      rank = index + 1;
      previous = time;
    }
    ranks.push(rank);
  });
  return ranks;
}

/**
 * Every finished-discipline table for one division, built once per refresh.
 * The data changes once a minute and is read by every client many times in
 * between, so the route that serves a page only slices what is here.
 */
export function buildRankingTables(pop: Populations): RankingTables {
  const build = (discipline: RankingDiscipline): readonly RankedEntry[] => {
    const timed = pop
      .atCheckpoint(rankingEnd(discipline))
      .flatMap((athlete) => {
        const timeMs = rankingTime(athlete, discipline);
        return timeMs === null ? [] : [{ athlete, timeMs }];
      })
      // Ties keep bib order so the same table comes out of every refresh.
      .sort(
        (a, b) =>
          a.timeMs - b.timeMs ||
          a.athlete.bib.localeCompare(b.athlete.bib, "en", { numeric: true }),
      );
    const ranks = competitionRanks(timed.map((entry) => entry.timeMs));
    return timed.map(({ athlete, timeMs }, index) => ({
      bib: athlete.bib,
      name: athlete.name,
      ageGroupId: athlete.ageGroup?.id ?? null,
      timeMs,
      rank: ranks[index] as number,
    }));
  };

  return {
    swim: build("swim"),
    bike: build("bike"),
    run: build("run"),
    total: build("total"),
  };
}
