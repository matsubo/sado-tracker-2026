import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authorizeRefresh } from "@/lib/api/refreshAuth";
import {
  badRequest,
  cachedJson,
  forbidden,
  liveJson,
  notFound,
  notReady,
  unauthorized,
} from "@/lib/api/respond";
import { fetchCsv } from "@/lib/csv/fetch";
import { raceEndsAt } from "@/lib/runtime/raceWindow";
import {
  claimPollerStart,
  getSnapshot,
  markStale,
  resetStore,
  setSnapshot,
} from "@/lib/runtime/store";

beforeEach(() => {
  // fetchCsv reports its retry on stderr; the tests below make it retry.
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});
afterEach(() => vi.restoreAllMocks());

describe("raceEndsAt", () => {
  it("is the hour the poller stops asking on race day", () => {
    expect(raceEndsAt("2026-09-06", {})).toBe(Date.parse("2026-09-06T23:00:00+09:00"));
    expect(raceEndsAt("2026-09-06", { FETCH_TO_HOUR: "22" })).toBe(
      Date.parse("2026-09-06T22:00:00+09:00"),
    );
  });

  it("is unknown when nothing is ever declared over", () => {
    expect(raceEndsAt("2026-09-06", { FETCH_WINDOW: "off" })).toBeNull();
    expect(raceEndsAt("2026-09-06", { REPLAY_START: "2025-09-07T06:00:00+09:00" })).toBeNull();
    expect(raceEndsAt("someday", {})).toBeNull();
    expect(raceEndsAt("2026-09-06", { FETCH_TO_HOUR: "late" })).toBeNull();
  });
});

describe("responses", () => {
  it("never lets race data come from the browser cache", async () => {
    const response = liveJson({ ok: true });
    expect(response.headers.get("cache-control")).toBe("no-cache, must-revalidate");
    expect(await response.json()).toEqual({ ok: true });
  });

  it("lets a caller add headers without losing the cache rule", () => {
    const response = liveJson({}, { headers: { link: '<x>; rel="next"' } });
    expect(response.headers.get("link")).toBe('<x>; rel="next"');
    expect(response.headers.get("cache-control")).toBe("no-cache, must-revalidate");
  });

  it("caches what can be cached for exactly as long as asked", () => {
    expect(cachedJson({}, 300).headers.get("cache-control")).toBe(
      "public, max-age=300, s-maxage=300",
    );
  });

  it("carries the status and a message for each failure", async () => {
    expect(notFound("x").status).toBe(404);
    expect(badRequest("x").status).toBe(400);
    expect(unauthorized("x").status).toBe(401);
    expect(forbidden("x").status).toBe(403);
    expect(await notFound("見つかりません").json()).toEqual({ error: "見つかりません" });
    const waiting = notReady();
    expect(waiting.status).toBe(503);
    expect(waiting.headers.get("retry-after")).toBe("5");
  });
});

describe("store", () => {
  it("lets the pollers start exactly once per process", () => {
    resetStore();
    expect(claimPollerStart()).toBe(true);
    expect(claimPollerStart()).toBe(false);
  });

  it("keeps the last good snapshot when marked stale", () => {
    resetStore();
    expect(getSnapshot()).toBeNull();
    markStale();
    expect(getSnapshot()).toBeNull();
    setSnapshot({ stale: false, year: 2026 } as never);
    markStale();
    expect(getSnapshot()?.stale).toBe(true);
    expect(getSnapshot()?.year).toBe(2026);
  });
});

describe("fetchCsv", () => {
  const body = new TextEncoder().encode("No.,名前\r\n1,x\r\n").buffer;

  it("retries once after a failure and returns the export", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 502 }))
      .mockResolvedValueOnce(new Response(body, { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    const result = await fetchCsv("https://example.test/x", { retryDelayMs: 0 });
    expect(result.byteLength).toBe(body.byteLength);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("gives up after the second failure with a named error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    await expect(fetchCsv("https://example.test/x", { retryDelayMs: 0 })).rejects.toMatchObject({
      name: "CsvFetchError",
      url: "https://example.test/x",
    });
  });

  it("treats an empty body as a failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(new ArrayBuffer(0), { status: 200 })),
    );
    await expect(fetchCsv("https://example.test/x", { retryDelayMs: 0 })).rejects.toThrow(/twice/);
  });
});

describe("authorizeRefresh", () => {
  it("accepts the configured token as a bearer header", () => {
    expect(authorizeRefresh({ REFRESH_TOKEN: "s3cret" }, "Bearer s3cret")).toBe("ok");
    expect(authorizeRefresh({ REFRESH_TOKEN: "s3cret" }, "bearer s3cret")).toBe("ok");
  });

  it("denies a wrong, missing or differently sized token", () => {
    expect(authorizeRefresh({ REFRESH_TOKEN: "s3cret" }, "Bearer wrong!")).toBe("denied");
    expect(authorizeRefresh({ REFRESH_TOKEN: "s3cret" }, "Bearer s3cre")).toBe("denied");
    expect(authorizeRefresh({ REFRESH_TOKEN: "s3cret" }, null)).toBe("denied");
  });

  it("is open on a private host but switched off in production when no token is set", () => {
    expect(authorizeRefresh({}, null)).toBe("ok");
    expect(authorizeRefresh({ NODE_ENV: "production" }, null)).toBe("disabled");
    expect(authorizeRefresh({ NODE_ENV: "production" }, "Bearer anything")).toBe("disabled");
  });
});
