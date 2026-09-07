// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => "/divisions/A",
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const { useQueryState } = await import("@/hooks/useQueryState");

beforeEach(() => {
  push.mockReset();
  replace.mockReset();
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
    const { result } = renderHook(() => useQueryState());
    act(() => result.current.update({ ageGroup: "M40-44", page: null }));
    expect(replace).toHaveBeenCalledWith("/divisions/A?discipline=swim&ageGroup=M40-44", {
      scroll: false,
    });
    expect(push).not.toHaveBeenCalled();
  });

  it("pushes a history entry for a move the back button should undo", () => {
    const { result } = renderHook(() => useQueryState());
    act(() => result.current.update({ page: "4" }, "push"));
    expect(push).toHaveBeenCalledWith("/divisions/A?discipline=swim&page=4", { scroll: false });
  });

  it("drops every key that becomes null, down to a bare path", () => {
    const { result } = renderHook(() => useQueryState());
    act(() => result.current.update({ discipline: null, page: null }));
    expect(replace).toHaveBeenCalledWith("/divisions/A", { scroll: false });
  });
});
