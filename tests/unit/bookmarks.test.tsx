// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBookmarks } from "@/hooks/useBookmarks";
import { BookmarksProvider } from "@/state/BookmarksProvider";
import { installStorage } from "../support/storage";

type GtagCall = [command: string, name: string, params: Record<string, unknown>];

function gtagCalls(): GtagCall[] {
  const spy = (window as unknown as { gtag: ReturnType<typeof vi.fn> }).gtag;
  return spy.mock.calls as GtagCall[];
}

beforeEach(() => {
  installStorage();
  window.history.replaceState(null, "", "/bookmarks");
  (window as unknown as { gtag: unknown }).gtag = vi.fn();
});

afterEach(() => {
  delete (window as unknown as { gtag?: unknown }).gtag;
});

describe("useBookmarks analytics", () => {
  it("reports an added bookmark with the screen it came from", async () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: BookmarksProvider });
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.add("1001", "search"));

    await waitFor(() => expect(result.current.bibs).toEqual(["1001"]));
    expect(gtagCalls()).toContainEqual(["event", "bookmark_add", { source: "search" }]);
  });

  it("reports a removed bookmark with the screen it came from", async () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: BookmarksProvider });
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.add("1001", "search"));
    await waitFor(() => expect(result.current.bibs).toEqual(["1001"]));
    act(() => result.current.remove("1001", "card"));

    await waitFor(() => expect(result.current.bibs).toEqual([]));
    expect(gtagCalls()).toContainEqual(["event", "bookmark_remove", { source: "card" }]);
  });

  it("falls back to a source name rather than sending none", async () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: BookmarksProvider });
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.add("1002"));

    await waitFor(() => expect(result.current.bibs).toEqual(["1002"]));
    const call = gtagCalls().find((entry) => entry[1] === "bookmark_add");
    expect(call?.[2].source).toBeTypeOf("string");
    expect(call?.[2].source).not.toBe("");
  });

  it("does not report a bookmark that was already there", async () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: BookmarksProvider });
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.add("1001", "search"));
    await waitFor(() => expect(result.current.bibs).toEqual(["1001"]));
    act(() => result.current.add("1001", "search"));

    const adds = gtagCalls().filter((entry) => entry[1] === "bookmark_add");
    expect(adds).toHaveLength(1);
  });

  it("does not report a removal of something that was never bookmarked", async () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: BookmarksProvider });
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.remove("9999", "card"));

    const removes = gtagCalls().filter((entry) => entry[1] === "bookmark_remove");
    expect(removes).toHaveLength(0);
  });

  it("works when analytics is switched off", async () => {
    delete (window as unknown as { gtag?: unknown }).gtag;
    const { result } = renderHook(() => useBookmarks(), { wrapper: BookmarksProvider });
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.add("1001", "search"));

    await waitFor(() => expect(result.current.bibs).toEqual(["1001"]));
  });
});
