import type { ComputedSnapshot } from "@/lib/compute/snapshot";
import { matchScore, NO_MATCH } from "./athleteMatch";
import type { AthletesResponseDto } from "./contract";
import { toAthleteSummary } from "./serialize";

const MAX_RESULTS = 50;

/** Nothing asked for, nothing returned; still a well-formed list. */
export function emptyAthletes(): AthletesResponseDto {
  return { count: 0, athletes: [], missing: [], _links: { self: { href: "/api/athletes" } } };
}

/**
 * Athletes whose bib or name answers what the reader typed, best match first.
 * The same tiers the leaderboard filter uses, so a name that finds someone in
 * the search box also finds them in the standings.
 */
export function searchAthletes(snapshot: ComputedSnapshot, query: string): AthletesResponseDto {
  const matches = [...snapshot.athletes.values()]
    .map((computed) => ({
      computed,
      score: matchScore(computed.athlete.bib, computed.athlete.nameKey, query),
    }))
    .filter((entry) => entry.score !== NO_MATCH)
    .sort((a, b) =>
      a.score === b.score
        ? a.computed.athlete.bib.localeCompare(b.computed.athlete.bib, "en", { numeric: true })
        : a.score - b.score,
    )
    .slice(0, MAX_RESULTS)
    .map((entry) => toAthleteSummary(entry.computed));

  return {
    count: matches.length,
    athletes: matches,
    missing: [],
    _links: { self: { href: `/api/athletes?q=${encodeURIComponent(query)}` } },
  };
}

/** The current state of a list of bibs in one round trip, naming any unknown. */
export function lookupAthletes(
  snapshot: ComputedSnapshot,
  bibs: readonly string[],
): AthletesResponseDto {
  const wanted = bibs.slice(0, MAX_RESULTS);
  const found = wanted.flatMap((bib) => {
    const computed = snapshot.athletes.get(bib);
    return computed ? [toAthleteSummary(computed)] : [];
  });
  return {
    count: found.length,
    athletes: found,
    missing: wanted.filter((bib) => !snapshot.athletes.has(bib)),
    _links: { self: { href: `/api/athletes?bibs=${encodeURIComponent(wanted.join(","))}` } },
  };
}
