// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useNotifications } from "@/hooks/useNotifications";
import type { PassEventDto } from "@/lib/api/contract";

function installStorage(): void {
  const entries = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => void entries.set(key, value),
      removeItem: (key: string) => void entries.delete(key),
      clear: () => entries.clear(),
      key: (index: number) => [...entries.keys()][index] ?? null,
      get length() {
        return entries.size;
      },
    },
  });
}

const START = Date.UTC(2026, 8, 5, 21, 0, 0);

function event(checkpointId: string, label: string, elapsedMs: number): PassEventDto {
  return {
    key: `1234:${checkpointId}`,
    bib: "1234",
    name: "両津 美咲",
    checkpointId,
    checkpointLabel: label,
    discipline: "bike",
    passedAt: START + elapsedMs,
    elapsedMs,
    divisionRank: { rank: 10, of: 400 },
    ageRank: null,
    segmentMs: null,
    segmentSpeedKmh: null,
    _links: { self: { href: "/api/athletes/1234" } },
  };
}

const BIKE_START = event("bikeS", "バイクS", 5_400_000);
const SUMIYOSHI = event("sumiyoshi", "住吉", 15_000_000);

beforeEach(installStorage);

describe("useNotifications", () => {
  it("announces every checkpoint passed, not only the latest, newest first", () => {
    const { result } = renderHook(() => useNotifications([SUMIYOSHI, BIKE_START]));
    expect(result.current.items.map((item) => item.checkpointLabel)).toEqual(["住吉", "バイクS"]);
    expect(result.current.unreadCount).toBe(2);
  });

  it("still surfaces an earlier checkpoint that the timing site publishes late", () => {
    const { result, rerender } = renderHook(
      ({ events }: { events: readonly PassEventDto[] }) => useNotifications(events),
      { initialProps: { events: [SUMIYOSHI] } },
    );
    act(() => result.current.markAllSeen());
    expect(result.current.unreadCount).toBe(0);

    // 住吉 was read; バイクS arrives afterwards even though it happened earlier.
    rerender({ events: [SUMIYOSHI, BIKE_START] });
    expect(result.current.unreadCount).toBe(1);
    expect(result.current.items.find((item) => item.unread)?.checkpointLabel).toBe("バイクS");
  });

  it("remembers what was read across a reload of the hook", () => {
    const first = renderHook(() => useNotifications([SUMIYOSHI, BIKE_START]));
    act(() => first.result.current.markAllSeen());
    const second = renderHook(() => useNotifications([SUMIYOSHI, BIKE_START]));
    expect(second.result.current.unreadCount).toBe(0);
  });
});
