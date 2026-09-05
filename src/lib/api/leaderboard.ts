import type { Division } from "@/config/races";
import type { ComputedSnapshot } from "@/lib/compute/snapshot";
import type { AthleteSummaryDto } from "./contract";
import { toAthleteSummary } from "./serialize";

export interface LeaderRowDto {
  readonly place: number;
  readonly athlete: AthleteSummaryDto;
}

export interface LeaderboardDto {
  readonly division: Division;
  readonly label: string;
  /** Everyone entered in the division. */
  readonly entrants: number;
  /** Athletes currently counted: racing, finished or retired. */
  readonly racing: number;
  readonly finished: number;
  readonly leaders: readonly LeaderRowDto[];
}

const DIVISIONS: readonly Division[] = ["A", "B", "RA", "RB"];

const LABELS: Record<Division, string> = {
  A: "Aタイプ",
  B: "Bタイプ",
  RA: "RAタイプ（リレー）",
  RB: "RBタイプ（リレー）",
};

/**
 * Who is at the front of each division right now. Ordering is field order,
 * not a cumulative rank: ranks taken at different checkpoints are not
 * comparable, so the only honest answer to "who is leading" is who has come
 * furthest, and among those, who got there fastest.
 */
export function buildLeaderboard(
  snapshot: ComputedSnapshot,
  division: Division,
  limit: number,
): LeaderboardDto {
  const order = snapshot.byDivision[division] ?? [];
  const leaders: LeaderRowDto[] = [];

  for (const bib of order.slice(0, limit)) {
    const computed = snapshot.athletes.get(bib);
    if (!computed) continue;
    leaders.push({ place: leaders.length + 1, athlete: toAthleteSummary(computed) });
  }

  let entrants = 0;
  for (const computed of snapshot.athletes.values()) {
    if (computed.athlete.division === division) entrants += 1;
  }

  return {
    division,
    label: LABELS[division],
    entrants,
    racing: snapshot.populations[division].all.length,
    finished: snapshot.counts[division].finish ?? 0,
    leaders,
  };
}

export function leaderboardDivisions(): readonly Division[] {
  return DIVISIONS;
}
