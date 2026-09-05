import { cachedJson } from "@/lib/api/respond";
import { getWeather } from "@/lib/weather";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const weather = await getWeather();
  return cachedJson({ ...weather, _links: { self: { href: "/api/weather" } } }, 300);
}
