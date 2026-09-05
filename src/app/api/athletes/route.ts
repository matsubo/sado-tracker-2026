import { z } from "zod";
import { matchScore, NO_MATCH } from "@/lib/api/athleteMatch";
import { badRequest, liveJson, notReady } from "@/lib/api/respond";
import { toAthleteSummary } from "@/lib/api/serialize";
import { getSnapshot } from "@/lib/runtime/store";

export const dynamic = "force-dynamic";

const MAX_RESULTS = 50;

const querySchema = z.object({
  q: z.string().trim().max(60).optional(),
  bibs: z.string().trim().max(600).optional(),
});

/**
 * Two jobs in one endpoint: search by bib or name while adding a friend, and
 * fetch the current state of an existing friend list in one round trip.
 */
export function GET(request: Request): Response {
  const snapshot = getSnapshot();
  if (!snapshot) return notReady();

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    bibs: url.searchParams.get("bibs") ?? undefined,
  });
  if (!parsed.success) return badRequest("検索条件が正しくありません。");

  const { q, bibs } = parsed.data;

  if (bibs) {
    const wanted = bibs
      .split(",")
      .map((bib) => bib.trim())
      .filter(Boolean)
      .slice(0, MAX_RESULTS);
    const found = wanted
      .map((bib) => snapshot.athletes.get(bib))
      .filter((computed) => computed !== undefined)
      .map(toAthleteSummary);
    return liveJson({
      count: found.length,
      athletes: found,
      missing: wanted.filter((bib) => !snapshot.athletes.has(bib)),
      _links: { self: { href: `/api/athletes?bibs=${bibs}` } },
    });
  }

  if (!q) {
    return liveJson({
      count: 0,
      athletes: [],
      missing: [],
      _links: { self: { href: "/api/athletes" } },
    });
  }

  // The same tiers the leaderboard filter uses, so a name that finds someone
  // in the search box also finds them in the standings.
  const matches = [...snapshot.athletes.values()]
    .map((computed) => ({
      computed,
      score: matchScore(computed.athlete.bib, computed.athlete.nameKey, q),
    }))
    .filter((entry) => entry.score !== NO_MATCH)
    .sort((a, b) =>
      a.score === b.score
        ? a.computed.athlete.bib.localeCompare(b.computed.athlete.bib, "en", { numeric: true })
        : a.score - b.score,
    )
    .slice(0, MAX_RESULTS)
    .map((entry) => toAthleteSummary(entry.computed));

  return liveJson({
    count: matches.length,
    athletes: matches,
    missing: [],
    _links: { self: { href: `/api/athletes?q=${encodeURIComponent(q)}` } },
  });
}
