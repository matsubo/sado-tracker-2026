import { z } from "zod";
import { DIVISIONS } from "@/config/races";
import { buildMapResponse } from "@/lib/api/map";
import { badRequest, liveJson, notReady } from "@/lib/api/respond";
import { getSnapshot } from "@/lib/runtime/store";

export const dynamic = "force-dynamic";

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
  const friends = (bibs ?? "")
    .split(",")
    .map((bib) => bib.trim())
    .filter(Boolean);

  return liveJson(buildMapResponse(snapshot, div, ageGroup ?? null, friends));
}
