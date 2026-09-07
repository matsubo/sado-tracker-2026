// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useLiveClock } from "@/hooks/useLivePosition";
import { useRaceState } from "@/hooks/useSnapshot";
import type { RaceStateDto } from "@/lib/api/contract";
import { AppProviders } from "@/state/AppProviders";
import { installStorage } from "../support/storage";

const RACE: RaceStateDto = {
  year: 2026,
  fetchedAt: 1_000,
  now: 1_000,
  stale: false,
  replay: false,
  pollIntervalMs: 60_000,
  finalResults: false,
  raceDate: "2026-09-06",
  historyYears: [],
  counts: { A: {}, B: {}, RA: {}, RB: {} },
  divisions: [],
  _links: { self: { href: "/api/race" } },
};

function BookmarkCount({ label }: { readonly label: string }) {
  const { bibs, add } = useBookmarks();
  return (
    <button type="button" onClick={() => add("1234", "test")}>
      {label}:{bibs.length}
    </button>
  );
}

function RaceYear({ label }: { readonly label: string }) {
  const { race } = useRaceState();
  return <span>{`${label}:${race?.year ?? "none"}`}</span>;
}

beforeEach(() => {
  installStorage();
  window.history.replaceState(null, "", "/");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(RACE))),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * Every screen used to build its own copy of the race state and the bookmark
 * list, so the header's bell and the page below it could disagree, and each
 * copy polled the race endpoint on its own timer.
 */
describe("app providers", () => {
  it("shares one bookmark list between every component that reads it", async () => {
    render(
      <AppProviders>
        <BookmarkCount label="header" />
        <BookmarkCount label="page" />
      </AppProviders>,
    );
    await screen.findByText("page:0");
    act(() => screen.getByText("page:0").click());
    expect(await screen.findByText("header:1")).toBeInTheDocument();
    expect(screen.getByText("page:1")).toBeInTheDocument();
  });

  it("polls the race endpoint once however many components read it", async () => {
    render(
      <AppProviders>
        <RaceYear label="header" />
        <RaceYear label="page" />
        <RaceYear label="footer" />
      </AppProviders>,
    );
    await waitFor(() => expect(screen.getByText("footer:2026")).toBeInTheDocument());
    const raceCalls = vi
      .mocked(globalThis.fetch)
      .mock.calls.filter((call) => String(call[0]).includes("/api/race"));
    expect(raceCalls).toHaveLength(1);
  });

  it("ticks one clock for every position that animates", () => {
    const { result } = renderHook(() => [useLiveClock(), useLiveClock()], {
      wrapper: AppProviders,
    });
    expect(result.current[0]).toBe(result.current[1]);
  });

  it("refuses to run a page outside the providers rather than polling on its own", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<RaceYear label="lost" />)).toThrow(/RaceProvider/);
  });
});
