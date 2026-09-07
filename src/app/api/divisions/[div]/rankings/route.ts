import { z } from "zod";
import { isDivision } from "@/config/races";
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

function linkHeader(base: string, page: number, total: number, perPage: number): string {
  const last = Math.max(1, Math.ceil(total / perPage));
  const parts = [`<${base}&page=1>; rel="first"`, `<${base}&page=${last}>; rel="last"`];
  if (page > 1) parts.push(`<${base}&page=${page - 1}>; rel="prev"`);
  if (page < last) parts.push(`<${base}&page=${page + 1}>; rel="next"`);
  return parts.join(", ");
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

  const base = `/api/divisions/${division}/rankings?discipline=${page.discipline}`;
  return liveJson(page, {
    headers: { link: linkHeader(base, page.page, page.total, PER_PAGE) },
  });
}
