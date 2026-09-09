// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { storageKey } from "@/config/site";
import { useBookmarkNotifications } from "@/hooks/useBookmarkNotifications";
import { useBookmarks } from "@/hooks/useBookmarks";
import type { EventsResponseDto, PassEventDto, RaceStateDto } from "@/lib/api/contract";
import { AppProviders } from "@/state/AppProviders";
import { installStorage } from "../support/storage";

const RACE = {
  year: 2026,
  fetchedAt: 1_000,
  now: 1_000,
  stale: false,
  replace: false,
  replay: false,
  pollIntervalMs: 60_000,
  finalResults: false,
  raceDate: "2026-09-06",
  historyYears: [],
  counts: { A: {}, B: {}, RA: {}, RB: {} },
  divisions: [],
  _links: { self: { href: "/api/race" } },
} as RaceStateDto;

/** Two checkpoints already behind every athlete this stand-in knows about. */
function passes(bib: string): PassEventDto[] {
  return ["bikeS", "sumiyoshi"].map((checkpointId, index) => ({
    key: `${bib}:${checkpointId}`,
    bib,
    name: `選手 ${bib}`,
    checkpointId,
    checkpointLabel: checkpointId,
    discipline: "bike",
    passedAt: 2_000 + index,
    elapsedMs: 1_000 * (index + 1),
    divisionRank: null,
    ageRank: null,
    segmentMs: null,
    segmentSpeedKmh: null,
    _links: { self: { href: `/api/athletes/${bib}` } },
  }));
}

/** The events endpoint as the server writes it, self link and all. */
function eventsBody(bibs: readonly string[]): EventsResponseDto {
  const events = bibs.flatMap(passes).sort((a, b) => b.passedAt - a.passedAt);
  return {
    count: events.length,
    events,
    _links: { self: { href: `/api/events?bibs=${encodeURIComponent(bibs.join(","))}` } },
  };
}

function renderBell() {
  return renderHook(() => ({ bell: useBookmarkNotifications(), bookmarks: useBookmarks() }), {
    wrapper: AppProviders,
  });
}

beforeEach(() => {
  installStorage();
  window.history.replaceState(null, "", "/bookmarks");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (!url.includes("/api/events")) return new Response(JSON.stringify(RACE));
      const bibs = (new URL(url, "http://localhost").searchParams.get("bibs") ?? "")
        .split(",")
        .filter(Boolean);
      return new Response(JSON.stringify(eventsBody(bibs)));
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Following someone is not an event. What they had already done shows in the
 * list, but the bell does not ring for a race that was run before anyone was
 * watching it.
 */
describe("the bookmark bell", () => {
  it("shows a first bookmark's race so far without ringing", async () => {
    window.localStorage.setItem(storageKey("bookmarks"), JSON.stringify(["1234"]));

    const { result } = renderBell();

    await waitFor(() => expect(result.current.bell.items).toHaveLength(2));
    expect(result.current.bell.unreadCount).toBe(0);
  });

  it("survives an answer that is not the one it asked for", async () => {
    window.localStorage.setItem(storageKey("bookmarks"), JSON.stringify(["1234"]));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        // A proxy error page, a truncated body: a 200 that is not the answer.
        const body = String(input).includes("/api/events") ? {} : RACE;
        return new Response(JSON.stringify(body));
      }),
    );

    const { result } = renderBell();

    await waitFor(() => expect(result.current.bell.bookmarkCount).toBe(1));
    expect(result.current.bell.items).toHaveLength(0);
    expect(result.current.bell.unreadCount).toBe(0);
  });

  it("stays quiet when a second athlete is bookmarked mid-race", async () => {
    window.localStorage.setItem(storageKey("bookmarks"), JSON.stringify(["1234"]));
    window.localStorage.setItem(storageKey("caughtUp"), JSON.stringify(["1234"]));
    window.localStorage.setItem(
      storageKey("seen"),
      JSON.stringify(passes("1234").map((event) => event.key)),
    );

    const { result } = renderBell();
    await waitFor(() => expect(result.current.bell.items).toHaveLength(2));

    act(() => result.current.bookmarks.add("5678", "test"));

    await waitFor(() => expect(result.current.bell.items).toHaveLength(4));
    expect(result.current.bell.unreadCount).toBe(0);
  });
});
