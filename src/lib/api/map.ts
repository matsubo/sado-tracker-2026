import type { Division } from "@/config/races";
import type { ComputedSnapshot } from "@/lib/compute/snapshot";
import type { MapResponseDto } from "./contract";
import { leaderboardHref, rankingsHref, toMapEntry } from "./serialize";

/** Every racing athlete's estimated position, leader first. */
export function buildMapResponse(
  snapshot: ComputedSnapshot,
  division: Division,
  ageGroupId: string | null,
  friendBibs: readonly string[],
): MapResponseDto {
  const friends = new Set(friendBibs);
  const entries = snapshot.byDivision[division].flatMap((bib) => {
    const computed = snapshot.athletes.get(bib);
    if (!computed) return [];
    if (ageGroupId !== null && computed.athlete.ageGroup?.id !== ageGroupId) return [];
    return [toMapEntry(computed, friends.has(bib))];
  });

  const self =
    ageGroupId === null
      ? `/api/map?div=${division}`
      : `/api/map?div=${division}&ageGroup=${encodeURIComponent(ageGroupId)}`;

  return {
    division,
    ageGroupId,
    fetchedAt: snapshot.fetchedAt,
    count: entries.length,
    entries,
    _links: {
      self: { href: self },
      leaderboard: { href: leaderboardHref(division) },
      rankings: { href: rankingsHref(division) },
    },
  };
}
