import { NextResponse } from "next/server";

/**
 * Race data must never come from the browser cache: a stale body under a
 * fresh update time would show numbers that disagree with the header.
 */
const LIVE_HEADERS = { "cache-control": "no-cache, must-revalidate" } as const;

export function liveJson<T>(body: T, init: ResponseInit = {}): NextResponse {
  return NextResponse.json(body, {
    ...init,
    headers: { ...LIVE_HEADERS, ...(init.headers ?? {}) },
  });
}

export function cachedJson<T>(body: T, seconds: number): NextResponse {
  return NextResponse.json(body, {
    headers: { "cache-control": `public, max-age=${seconds}, s-maxage=${seconds}` },
  });
}

export function notFound(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 404, headers: LIVE_HEADERS });
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400, headers: LIVE_HEADERS });
}

/** The snapshot is not ready until the first poll completes. */
export function notReady(): NextResponse {
  return NextResponse.json(
    { error: "レースデータを取得中です。まもなく表示できます。" },
    { status: 503, headers: { ...LIVE_HEADERS, "retry-after": "5" } },
  );
}
