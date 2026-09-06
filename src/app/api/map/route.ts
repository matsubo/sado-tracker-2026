import { z } from "zod";
import { badRequest, liveJson, notFound, notReady } from "@/lib/api/respond";
import { toMapEntry } from "@/lib/api/serialize";
import { getSnapshot } from "@/lib/runtime/store";

export const dynamic = "force-dynamic";

const DIVISIONS = ["A", "B", "RA", "RB"] as const;

const querySchema = z.object({
  div: z.enum(DIVISIONS).default("A"),
  ageGroup: z.string().trim().max(12).optional(),
  bibs: z.string().trim().max(600).optional(),
});

/** Every racing athlete's estimated position, ordered leader first. */
export function GET(request: Request): Response {
  const snapshot = getSnapshot();
  if (!snapshot) return notReady();

  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return badRequest("表示条件が正しくありません。");

  const { div, ageGroup, bibs } = parsed.data;
  const order = snapshot.byDivision[div];
  if (!order) return notFound(`タイプ ${div} はありません。`);

  const friends = new Set(
    (bibs ?? "")
      .split(",")
      .map((bib) => bib.trim())
      .filter(Boolean),
  );

  const entries = order
    .map((bib) => snapshot.athletes.get(bib))
    .filter((computed) => computed !== undefined)
    .filter((computed) => !ageGroup || computed.athlete.ageGroup?.id === ageGroup)
    .map((computed) => toMapEntry(computed, friends.has(computed.athlete.bib)));

  return liveJson({
    division: div,
    ageGroupId: ageGroup ?? null,
    fetchedAt: snapshot.fetchedAt,
    count: entries.length,
    entries,
    _links: { self: { href: `/api/map?div=${div}` } },
  });
}
