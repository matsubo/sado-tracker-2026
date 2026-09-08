// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { storageKey } from "@/config/site";
import type { EventsResponseDto, RaceStateDto } from "@/lib/api/contract";
import { currentPageTitle } from "@/lib/pageTitle";
import { renderWithProviders } from "../support/providers";
import { installStorage } from "../support/storage";

vi.mock("next/navigation", () => ({
  usePathname: () => "/bookmarks",
  useSearchParams: () => new URLSearchParams(),
}));

const { PageHeader } = await import("@/components/layout/PageHeader");

const RACE: RaceStateDto = {
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

const EVENTS: EventsResponseDto = {
  count: 1,
  events: [
    {
      key: "1234:sumiyoshi",
      bib: "1234",
      name: "両津 美咲",
      checkpointId: "sumiyoshi",
      checkpointLabel: "住吉",
      discipline: "bike",
      passedAt: 2_000,
      elapsedMs: 1_000,
      divisionRank: null,
      ageRank: null,
      segmentMs: null,
      segmentSpeedKmh: null,
      _links: { self: { href: "/api/athletes/1234" } },
    },
  ],
  _links: { self: { href: "/api/events?bibs=1234" } },
};

beforeEach(() => {
  installStorage();
  window.localStorage.setItem(storageKey("bookmarks"), JSON.stringify(["1234"]));
  // Already following this athlete, so the pass below is news. A bookmark
  // added just now would bring their race so far in already read.
  window.localStorage.setItem(storageKey("caughtUp"), JSON.stringify(["1234"]));
  window.history.replaceState(null, "", "/bookmarks");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const body = String(input).includes("/api/events") ? EVENTS : RACE;
      return new Response(JSON.stringify(body));
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * The tab has to name the screen, and the unread count has to sit in front of
 * that name rather than replace it. Two effects used to fight over the
 * title: one wrote the count over a bare site name, the other put the page
 * name back, so the count never stayed on screen.
 */
describe("document title", () => {
  it("names the page, with the unread count in front of it", async () => {
    renderWithProviders(
      <PageHeader title="ブックマーク" race={RACE} lastPolledAt={0} error={null} />,
    );
    await waitFor(() => expect(document.title).toBe("(1) ブックマーク | 佐渡トラッカー 2026"));
    expect(currentPageTitle()).toBe("ブックマーク | 佐渡トラッカー 2026");
  });
});
