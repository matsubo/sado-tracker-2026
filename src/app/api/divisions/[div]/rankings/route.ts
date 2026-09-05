import { z } from "zod";
import { buildRankingPage, type RankingDiscipline } from "@/lib/api/rankings";
import { badRequest, liveJson, notFound, notReady } from "@/lib/api/respond";
import { getSnapshot } from "@/lib/runtime/store";

export const dynamic = "force-dynamic";

const DIVISIONS = ["A", "B", "RA", "RB"] as const;
const PER_PAGE = 50;

const querySchema = z.object({
  discipline: z.enum(["swim", "bike", "run", "total"]).default("total"),
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
  const division = DIVISIONS.find((candidate) => candidate === div.toUpperCase());
  if (!division) return notFound(`部門 ${div} はありません。`);

  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return badRequest("表示条件が正しくありません。");

  const page = buildRankingPage(snapshot, {
    division,
    discipline: parsed.data.discipline as RankingDiscipline,
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
