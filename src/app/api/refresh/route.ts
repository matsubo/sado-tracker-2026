import { badRequest, liveJson, notReady } from "@/lib/api/respond";
import { toRaceState } from "@/lib/api/serialize";
import { refreshNow } from "@/lib/runtime/poller";
import { getSnapshot } from "@/lib/runtime/store";

export const dynamic = "force-dynamic";

/**
 * Fetch the timing records now, ignoring the hours the poller normally keeps
 * to. Useful when a server is started before the race or restarted after it,
 * and when a checkpoint is published late and the wait is not acceptable.
 *
 * A token is required whenever REFRESH_TOKEN is set; without it the endpoint
 * is open, which is fine on a private host and not on a public one.
 */
export async function POST(request: Request): Promise<Response> {
  const expected = process.env.REFRESH_TOKEN;
  if (expected) {
    const given =
      new URL(request.url).searchParams.get("token") ??
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (given !== expected) return badRequest("トークンが正しくありません。");
  }

  const started = await refreshNow();
  if (!started) return notReady();

  const snapshot = getSnapshot();
  if (!snapshot) return notReady();

  return liveJson({ refreshed: true, ...toRaceState(snapshot) });
}
