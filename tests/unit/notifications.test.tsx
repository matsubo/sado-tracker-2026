// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useNotifications } from "@/hooks/useNotifications";
import type { PassEventDto } from "@/lib/api/contract";
import { installStorage } from "../support/storage";

const START = Date.UTC(2026, 8, 5, 21, 0, 0);

function event(bib: string, checkpointId: string, label: string, elapsedMs: number): PassEventDto {
  return {
    key: `${bib}:${checkpointId}`,
    bib,
    name: bib === "1234" ? "両津 美咲" : "相川 健",
    checkpointId,
    checkpointLabel: label,
    discipline: "bike",
    passedAt: START + elapsedMs,
    elapsedMs,
    divisionRank: { rank: 10, of: 400 },
    ageRank: null,
    segmentMs: null,
    segmentSpeedKmh: null,
    _links: { self: { href: `/api/athletes/${bib}` } },
  };
}

const BIKE_START = event("1234", "bikeS", "バイクS", 5_400_000);
const SUMIYOSHI = event("1234", "sumiyoshi", "住吉", 15_000_000);
const OTHER_BIKE_START = event("5678", "bikeS", "バイクS", 5_500_000);
const OTHER_SUMIYOSHI = event("5678", "sumiyoshi", "住吉", 15_100_000);

interface Props {
  readonly events: readonly PassEventDto[];
  readonly covered: readonly string[] | null;
}

/** The hook as a page drives it: a list of passes, and whose it is complete for. */
function renderNotifications(initialProps: Props) {
  return renderHook(({ events, covered }: Props) => useNotifications(events, covered), {
    initialProps,
  });
}

beforeEach(installStorage);

describe("useNotifications", () => {
  it("announces every checkpoint passed, not only the latest, newest first", () => {
    const { result } = renderNotifications({
      events: [SUMIYOSHI, BIKE_START],
      covered: ["1234"],
    });
    expect(result.current.items.map((item) => item.checkpointLabel)).toEqual(["住吉", "バイクS"]);
  });

  it("lists what a newly bookmarked athlete has already done without calling it new", () => {
    const { result } = renderNotifications({
      events: [SUMIYOSHI, BIKE_START],
      covered: ["1234"],
    });
    expect(result.current.items).toHaveLength(2);
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.items.every((item) => !item.unread)).toBe(true);
  });

  it("counts the first checkpoint of an athlete bookmarked before the race as new", () => {
    const { result, rerender } = renderNotifications({ events: [], covered: ["1234"] });
    rerender({ events: [BIKE_START], covered: ["1234"] });
    expect(result.current.unreadCount).toBe(1);
  });

  it("still surfaces an earlier checkpoint that the timing site publishes late", () => {
    const { result, rerender } = renderNotifications({ events: [], covered: ["1234"] });
    rerender({ events: [SUMIYOSHI], covered: ["1234"] });
    act(() => result.current.markAllSeen());
    expect(result.current.unreadCount).toBe(0);

    // 住吉 was read; バイクS arrives afterwards even though it happened earlier.
    rerender({ events: [SUMIYOSHI, BIKE_START], covered: ["1234"] });
    expect(result.current.unreadCount).toBe(1);
    expect(result.current.items.find((item) => item.unread)?.checkpointLabel).toBe("バイクS");
  });

  it("keeps one athlete's unread pass while taking on a second athlete's history", () => {
    const { result, rerender } = renderNotifications({ events: [], covered: ["1234"] });
    rerender({ events: [SUMIYOSHI], covered: ["1234"] });
    expect(result.current.unreadCount).toBe(1);

    rerender({
      events: [SUMIYOSHI, OTHER_SUMIYOSHI, OTHER_BIKE_START],
      covered: ["1234", "5678"],
    });
    expect(result.current.items).toHaveLength(3);
    expect(result.current.unreadCount).toBe(1);
    expect(result.current.items.find((item) => item.unread)?.bib).toBe("1234");
  });

  it("takes on the history again when an athlete is bookmarked a second time", () => {
    const { result, rerender } = renderNotifications({ events: [], covered: ["1234"] });
    rerender({ events: [BIKE_START], covered: ["1234"] });
    act(() => result.current.markAllSeen());

    // The bookmark is removed, the athlete rides on, and it is put back.
    rerender({ events: [], covered: [] });
    rerender({ events: [SUMIYOSHI, BIKE_START], covered: ["1234"] });
    expect(result.current.items).toHaveLength(2);
    expect(result.current.unreadCount).toBe(0);
  });

  it("survives a bookmark list that names the same athlete twice", () => {
    // Storage written by an older build, or edited by hand, can repeat a
    // bib. Counting names rather than athletes would leave the list forever
    // behind what it has taken on, and re-render without end.
    const { result } = renderNotifications({ events: [BIKE_START], covered: ["1234", "1234"] });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.unreadCount).toBe(0);
  });

  it("says nothing is new while it does not yet know whose list this is", () => {
    const { result } = renderNotifications({ events: [SUMIYOSHI], covered: null });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.unreadCount).toBe(0);
  });

  it("remembers what was read across a reload of the hook", () => {
    const first = renderNotifications({ events: [], covered: ["1234"] });
    first.rerender({ events: [SUMIYOSHI], covered: ["1234"] });
    act(() => first.result.current.markAllSeen());

    // A pass that arrived while the tab was closed is new; the one already
    // read stays read, and the history is not taken on a second time.
    const second = renderNotifications({ events: [SUMIYOSHI, BIKE_START], covered: ["1234"] });
    expect(second.result.current.unreadCount).toBe(1);
    expect(second.result.current.items.find((item) => item.unread)?.checkpointLabel).toBe(
      "バイクS",
    );
  });
});
