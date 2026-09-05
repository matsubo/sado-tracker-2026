import { z } from "zod";
import { toAthleteSummary } from "@/lib/api/serialize";
import { badRequest, liveJson, notReady } from "@/lib/api/respond";
import { normalizeName } from "@/config/races";
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
    const wanted = bibs.split(",").map((bib) => bib.trim()).filter(Boolean).slice(0, MAX_RESULTS);
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
    return liveJson({ count: 0, athletes: [], missing: [], _links: { self: { href: "/api/athletes" } } });
  }

  const needle = normalizeName(q);
  const matches = [...snapshot.athletes.values()]
    .filter(
      (computed) =>
        computed.athlete.bib.startsWith(needle) ||
        computed.athlete.nameKey.includes(needle) ||
        computed.athlete.nameKey.replace(/ /g, "").includes(needle.replace(/ /g, "")),
    )
    .slice(0, MAX_RESULTS)
    .map(toAthleteSummary);

  return liveJson({
    count: matches.length,
    athletes: matches,
    missing: [],
    _links: { self: { href: `/api/athletes?q=${encodeURIComponent(q)}` } },
  });
}
