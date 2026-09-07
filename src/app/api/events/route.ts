import { z } from "zod";
import { buildEventsResponse } from "@/lib/api/events";
import { badRequest, liveJson, notReady } from "@/lib/api/respond";
import { getSnapshot } from "@/lib/runtime/store";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  bibs: z.string().trim().max(600).default(""),
});

/** Every checkpoint the given athletes have passed, newest first. */
export function GET(request: Request): Response {
  const snapshot = getSnapshot();
  if (!snapshot) return notReady();

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return badRequest("通知の条件が正しくありません。");

  const bibs = parsed.data.bibs
    .split(",")
    .map((bib) => bib.trim())
    .filter(Boolean);
  return liveJson(buildEventsResponse(snapshot, bibs));
}
