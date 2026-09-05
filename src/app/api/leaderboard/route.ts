import { z } from "zod";
import { buildLeaderboard } from "@/lib/api/leaderboard";
import { badRequest, liveJson, notReady } from "@/lib/api/respond";
import { getSnapshot } from "@/lib/runtime/store";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  div: z.enum(["A", "B", "RA", "RB"]).default("A"),
  perPage: z.coerce.number().int().min(1).max(200).default(100),
  page: z.coerce.number().int().min(1).max(100).default(1),
  q: z.string().trim().max(60).default(""),
});

/** One page of a division, ordered by how far along the course each athlete is. */
export function GET(request: Request): Response {
  const snapshot = getSnapshot();
  if (!snapshot) return notReady();

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return badRequest("表示条件が正しくありません。");

  const board = buildLeaderboard(
    snapshot,
    parsed.data.div,
    parsed.data.perPage,
    parsed.data.page,
    parsed.data.q,
  );
  return liveJson({
    ...board,
    _links: {
      self: { href: `/api/leaderboard?div=${board.division}` },
      division: { href: `/api/divisions/${board.division}/rankings` },
      map: { href: `/api/map?div=${board.division}` },
    },
  });
}
