import { toRaceState } from "@/lib/api/serialize";
import { liveJson, notReady } from "@/lib/api/respond";
import { getSnapshot } from "@/lib/runtime/store";

export const dynamic = "force-dynamic";

/** Small polling endpoint: the client watches fetchedAt and refetches on change. */
export function GET(): Response {
  const snapshot = getSnapshot();
  if (!snapshot) return notReady();
  return liveJson(toRaceState(snapshot));
}
