import { authorizeRefresh } from "@/lib/api/refreshAuth";
import { forbidden, liveJson, notReady, unauthorized } from "@/lib/api/respond";
import { toRaceState } from "@/lib/api/serialize";
import { refreshNow } from "@/lib/runtime/poller";
import { getSnapshot } from "@/lib/runtime/store";

export const dynamic = "force-dynamic";

/**
 * Fetch the timing records now, ignoring the hours the poller normally keeps
 * to. Useful when a server is started before the race or restarted after it,
 * and when a checkpoint is published late and the wait is not acceptable.
 *
 * The bearer token in REFRESH_TOKEN is required whenever it is set, and it
 * must be set in production: without it the endpoint refuses rather than
 * letting anyone on the internet make this server fetch.
 */
export async function POST(request: Request): Promise<Response> {
  const decision = authorizeRefresh(process.env, request.headers.get("authorization"));
  if (decision === "disabled") {
    return forbidden("REFRESH_TOKEN が設定されていないため、手動更新は無効です。");
  }
  if (decision === "denied") return unauthorized("トークンが正しくありません。");

  const started = await refreshNow();
  if (!started) return notReady();

  const snapshot = getSnapshot();
  if (!snapshot) return notReady();

  return liveJson({ refreshed: true, ...toRaceState(snapshot) });
}
