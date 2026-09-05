import { z } from "zod";
import { buildLeaderboard } from "@/lib/api/leaderboard";
import { badRequest, liveJson, notReady } from "@/lib/api/respond";
import { getSnapshot } from "@/lib/runtime/store";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  div: z.enum(["A", "B", "RA", "RB"]).default("A"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** The front of one division, ordered by how far along the course they are. */
export function GET(request: Request): Response {
  const snapshot = getSnapshot();
  if (!snapshot) return notReady();

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return badRequest("表示条件が正しくありません。");

  const board = buildLeaderboard(snapshot, parsed.data.div, parsed.data.limit);
  return liveJson({
    ...board,
    _links: {
      self: { href: `/api/leaderboard?div=${board.division}` },
      division: { href: `/api/divisions/${board.division}/rankings` },
      map: { href: `/api/map?div=${board.division}` },
    },
  });
}
