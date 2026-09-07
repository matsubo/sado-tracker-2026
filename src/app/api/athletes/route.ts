import { z } from "zod";
import { emptyAthletes, lookupAthletes, searchAthletes } from "@/lib/api/athletes";
import { badRequest, liveJson, notReady } from "@/lib/api/respond";
import { getSnapshot } from "@/lib/runtime/store";

export const dynamic = "force-dynamic";

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
      .filter(Boolean);
    return liveJson(lookupAthletes(snapshot, wanted));
  }
  return liveJson(q ? searchAthletes(snapshot, q) : emptyAthletes());
}
