// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// No router here on purpose: a query change is a shallow update, written with
// the history API the App Router syncs with, never a navigation that fetches
// the page again from the server.
vi.mock("next/navigation", () => ({
  usePathname: () => "/divisions/A",
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const { useQueryState } = await import("@/hooks/useQueryState");

beforeEach(() => {
  window.history.replaceState(null, "", "/divisions/A?discipline=swim&page=3");
});

/**
 * Three screens used to write the address bar three different ways: one
 * through the router, one straight into history, one not at all. This is the
 * one way, and it says whether a change is a new place or a narrower view.
 */
describe("useQueryState", () => {
  it("reads the current query", () => {
    const { result } = renderHook(() => useQueryState());
    expect(result.current.params.get("discipline")).toBe("swim");
    expect(result.current.params.get("page")).toBe("3");
  });

  it("replaces the address for a narrower view of the same screen", () => {
    const before = window.history.length;
    const { result } = renderHook(() => useQueryState());
    act(() => result.current.update({ ageGroup: "M40-44", page: null }));
    expect(window.location.search).toBe("?discipline=swim&ageGroup=M40-44");
    expect(window.history.length).toBe(before);
  });

  it("pushes a history entry for a move the back button should undo", () => {
    const before = window.history.length;
    const { result } = renderHook(() => useQueryState());
    act(() => result.current.update({ page: "4" }, "push"));
    expect(window.location.search).toBe("?discipline=swim&page=4");
    expect(window.history.length).toBe(before + 1);
  });

  it("drops every key that becomes null, down to a bare path", () => {
    const { result } = renderHook(() => useQueryState());
    act(() => result.current.update({ discipline: null, page: null }));
    expect(window.location.pathname + window.location.search).toBe("/divisions/A");
  });

  it("leaves history alone when the address would not change", () => {
    const before = window.history.length;
    const { result } = renderHook(() => useQueryState());
    act(() => result.current.update({ discipline: "swim" }, "push"));
    expect(window.history.length).toBe(before);
  });
});
