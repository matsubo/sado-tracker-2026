import { describe, expect, it } from "vitest";
import { reportedPath } from "@/lib/analytics";

const params = (query: string) => new URLSearchParams(query);

describe("reportedPath", () => {
  it("reports a plain path unchanged", () => {
    expect(reportedPath("/help", params(""))).toBe("/help");
  });

  it("keeps the parameters that say which view was open", () => {
    expect(reportedPath("/map", params("div=B"))).toBe("/map?div=B");
    expect(reportedPath("/divisions/A", params("discipline=bike&page=2"))).toBe(
      "/divisions/A?discipline=bike&page=2",
    );
    expect(reportedPath("/divisions/A", params("ageGroup=M30-34"))).toBe(
      "/divisions/A?ageGroup=M30-34",
    );
  });

  it("drops the bookmark list, which says who the reader follows", () => {
    expect(reportedPath("/bookmarks", params("bibs=101,102"))).toBe("/bookmarks");
  });

  it("drops a single chosen bib, which says who the reader came for", () => {
    expect(reportedPath("/divisions/A", params("bib=1234&discipline=run"))).toBe(
      "/divisions/A?discipline=run",
    );
  });

  it("drops anything it has not been told is safe, so a new parameter cannot leak", () => {
    expect(reportedPath("/help", params("q=%E5%B1%B1%E7%94%B0&div=A"))).toBe("/help?div=A");
  });

  it("orders the kept parameters the same way whatever order they arrived in", () => {
    expect(reportedPath("/divisions/A", params("page=2&div=A"))).toBe(
      reportedPath("/divisions/A", params("div=A&page=2")),
    );
  });
});
