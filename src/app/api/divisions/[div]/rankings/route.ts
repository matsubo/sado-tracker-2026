import { z } from "zod";
import { isDivision } from "@/config/races";
import type { Links } from "@/lib/api/contract";
import { buildRankingPage } from "@/lib/api/rankings";
import { badRequest, liveJson, notFound, notReady } from "@/lib/api/respond";
import { RANKING_DISCIPLINES } from "@/lib/compute/tables";
import { getSnapshot } from "@/lib/runtime/store";

export const dynamic = "force-dynamic";

const PER_PAGE = 50;

const querySchema = z.object({
  discipline: z.enum(RANKING_DISCIPLINES).default("total"),
  ageGroup: z.string().trim().max(12).optional(),
  page: z.coerce.number().int().min(1).max(200).optional(),
  bib: z.string().trim().max(12).optional(),
});

/** RFC 5988 pagination header, from the same links the body carries. */
function linkHeader(links: Links): string {
  return (["first", "last", "prev", "next"] as const)
    .flatMap((rel) => (links[rel] ? [`<${links[rel].href}>; rel="${rel}"`] : []))
    .join(", ");
}

export async function GET(
  request: Request,
  context: { params: Promise<{ div: string }> },
): Promise<Response> {
  const snapshot = getSnapshot();
  if (!snapshot) return notReady();

  const { div } = await context.params;
  const division = div.toUpperCase();
  if (!isDivision(division)) return notFound(`タイプ ${div} はありません。`);

  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return badRequest("表示条件が正しくありません。");

  const page = buildRankingPage(snapshot, {
    division,
    discipline: parsed.data.discipline,
    ageGroupId: parsed.data.ageGroup ?? null,
    page: parsed.data.page ?? null,
    perPage: PER_PAGE,
    targetBib: parsed.data.bib ?? null,
  });

  return liveJson(page, { headers: { link: linkHeader(page._links) } });
}
