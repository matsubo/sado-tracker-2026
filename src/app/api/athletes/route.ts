import { z } from "zod";
import { normalizeName } from "@/config/races";
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

  const needle = normalizeName(q);
  const squashed = needle.replace(/ /g, "");

  /**
   * Rank matches so the suggestion list is useful while typing: an exact bib
   * first, then a bib or family-name prefix, then anything containing the
   * text. Within a tier, lower bibs come first so the order is stable.
   */
  const score = (bib: string, nameKey: string): number => {
    if (bib === needle) return 0;
    if (bib.startsWith(needle)) return 1;
    if (nameKey.startsWith(needle)) return 2;
    if (nameKey.replace(/ /g, "").startsWith(squashed)) return 3;
    if (nameKey.includes(needle)) return 4;
    if (nameKey.replace(/ /g, "").includes(squashed)) return 5;
    return Number.MAX_SAFE_INTEGER;
  };

  const matches = [...snapshot.athletes.values()]
    .map((computed) => ({
      computed,
      score: score(computed.athlete.bib, computed.athlete.nameKey),
    }))
    .filter((entry) => entry.score !== Number.MAX_SAFE_INTEGER)
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
