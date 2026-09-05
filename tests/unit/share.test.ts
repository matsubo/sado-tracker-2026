import { describe, expect, it } from "vitest";
import { shareHref, shareUrl } from "@/lib/share";

describe("shareUrl", () => {
  it("keeps the page being read", () => {
    expect(shareUrl("https://sado-tracker-2026.teraren.com/athletes/1001")).toBe(
      "https://sado-tracker-2026.teraren.com/athletes/1001",
    );
  });

  it("never shares a bookmark list that arrived in the address bar", () => {
    expect(shareUrl("https://sado-tracker-2026.teraren.com/bookmarks?bibs=1001,1002")).toBe(
      "https://sado-tracker-2026.teraren.com/bookmarks",
    );
  });

  it("drops any other query or fragment as well", () => {
    expect(shareUrl("https://example.test/divisions/A?discipline=swim&page=3#row-12")).toBe(
      "https://example.test/divisions/A",
    );
  });
});

describe("shareHref", () => {
  const url = "https://sado-tracker-2026.teraren.com/athletes/1001";
  const text = "佐渡トラッカー";

  it("sends the title and the link to X", () => {
    const href = shareHref("x", url, text);
    expect(href).toContain("x.com/intent/post");
    expect(href).toContain(encodeURIComponent(url));
    expect(href).toContain(encodeURIComponent(text));
  });

  it("sends only the link to Facebook, which reads the card itself", () => {
    const href = shareHref("facebook", url, text);
    expect(href).toContain("facebook.com/sharer");
    expect(href).toContain(encodeURIComponent(url));
    expect(href).not.toContain(encodeURIComponent(text));
  });

  it("sends the title and the link to LINE", () => {
    const href = shareHref("line", url, text);
    expect(href).toContain("line.me");
    expect(href).toContain(encodeURIComponent(url));
  });

  it("escapes a title that would otherwise break the query", () => {
    const href = shareHref("x", url, "寺澤 光介 & 佐渡 #tri?x=1");
    expect(href).not.toContain(" ");
    expect(href).toContain("%23tri");
    expect(href.split("&url=")).toHaveLength(2);
  });
});
