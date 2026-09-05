import { toAthleteDetail } from "@/lib/api/serialize";
import { liveJson, notFound, notReady } from "@/lib/api/respond";
import { getSnapshot } from "@/lib/runtime/store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ bib: string }> },
): Promise<Response> {
  const snapshot = getSnapshot();
  if (!snapshot) return notReady();

  const { bib } = await context.params;
  const computed = snapshot.athletes.get(bib);
  if (!computed) return notFound(`ゼッケン ${bib} は見つかりませんでした。`);

  return liveJson(toAthleteDetail(snapshot, computed));
}
