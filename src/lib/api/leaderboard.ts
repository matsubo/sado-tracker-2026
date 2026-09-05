import { type Division, normalizeName } from "@/config/races";
import type { ComputedSnapshot } from "@/lib/compute/snapshot";
import { matchesAthlete } from "./athleteMatch";
import type { AthleteSummaryDto } from "./contract";
import { toAthleteSummary } from "./serialize";

export interface LeaderRowDto {
  readonly place: number;
  readonly athlete: AthleteSummaryDto;
}

export interface LeaderboardDto {
  readonly division: Division;
  readonly label: string;
  /** How the rows are ordered: by progress once anyone is measured, else by bib. */
  readonly order: "field" | "bib";
  /** Everyone entered in the division. */
  readonly entrants: number;
  /** Athletes currently counted: racing, finished or retired. */
  readonly racing: number;
  readonly finished: number;
  /**
   * How many rows the reader is paging through: the whole field, or the
   * matches when a filter is set.
   */
  readonly total: number;
  /** The filter in force, normalised; empty when the whole field is shown. */
  readonly query: string;
  readonly page: number;
  readonly perPage: number;
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
  perPage: number,
  page = 1,
  query = "",
): LeaderboardDto {
  // Until a checkpoint has fired there is nothing to order by, and an empty
  // front page says nothing about a race with 1,857 entrants. The whole
  // division is listed by bib until the first reading gives it a real order.
  const readings = Object.values(snapshot.counts[division] ?? {}).reduce(
    (total, count) => total + count,
    0,
  );
  const started = readings > 0;
  const field = started ? (snapshot.byDivision[division] ?? []) : entrantsByBib(snapshot, division);

  // Filtering keeps the field order and each athlete's place in it: someone
  // looking up one name still wants to see that they are 137th, not 1st of
  // the one row that matched.
  const needle = normalizeName(query);
  const order =
    needle === ""
      ? field.map((bib, index) => ({ bib, place: index + 1 }))
      : field
          .map((bib, index) => ({ bib, place: index + 1 }))
          .filter(({ bib }) => {
            const computed = snapshot.athletes.get(bib);
            return computed
              ? matchesAthlete(computed.athlete.bib, computed.athlete.nameKey, needle)
              : false;
          });

  const start = Math.max(0, (page - 1) * perPage);
  const leaders: LeaderRowDto[] = [];

  // Place is the athlete's position in the whole field, not on this page and
  // not among the matches.
  for (const { bib, place } of order.slice(start, start + perPage)) {
    const computed = snapshot.athletes.get(bib);
    if (!computed) continue;
    leaders.push({ place, athlete: toAthleteSummary(computed) });
  }

  let entrants = 0;
  for (const computed of snapshot.athletes.values()) {
    if (computed.athlete.division === division) entrants += 1;
  }

  return {
    division,
    label: LABELS[division],
    order: started ? "field" : "bib",
    entrants,
    racing: snapshot.populations[division].all.length,
    finished: snapshot.counts[division].finish ?? 0,
    total: order.length,
    query: needle,
    page,
    perPage,
    leaders,
  };
}

export function leaderboardDivisions(): readonly Division[] {
  return DIVISIONS;
}

/** Everyone entered in a division, in bib order. */
function entrantsByBib(snapshot: ComputedSnapshot, division: Division): string[] {
  return [...snapshot.athletes.values()]
    .filter((computed) => computed.athlete.division === division)
    .map((computed) => computed.athlete.bib)
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}
