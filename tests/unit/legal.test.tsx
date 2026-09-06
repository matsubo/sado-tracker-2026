// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrivacyContent } from "@/components/legal/PrivacyContent";
import { TermsContent } from "@/components/legal/TermsContent";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/privacy",
  useSearchParams: () => new URLSearchParams(),
}));

// The legal pages carry the same header as every other screen, and that
// header polls. Neither page has anything to say about the race, so the
// network is replaced rather than exercised here.
vi.mock("@/hooks/useSnapshot", () => ({
  useRaceState: () => ({
    race: null,
    auto: true,
    setAuto: () => {},
    intervalMs: 15_000,
    fetchedAt: null,
    error: null,
    lastPolledAt: 0,
    refresh: () => {},
  }),
  useLiveResource: () => ({ data: null, error: null, missing: false, loading: false }),
}));

/** jsdom 29 leaves `window.localStorage` undefined; the bell reads it. */
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

const DISCORD = "https://discord.gg/FRzmgpCySV";

beforeEach(installStorage);
afterEach(cleanup);

describe("PrivacyContent", () => {
  it("names itself in the heading", () => {
    render(<PrivacyContent />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("プライバシーポリシー");
  });

  it("says what stays in the browser and never reaches the server", () => {
    render(<PrivacyContent />);
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/ブックマーク/);
    expect(text).toMatch(/サーバーには送/);
  });

  it("discloses both third parties the reader's browser actually contacts", () => {
    render(<PrivacyContent />);
    const text = document.body.textContent ?? "";
    // GA sets a cookie, so the page must not claim otherwise.
    expect(text).toMatch(/Google アナリティクス/);
    expect(text).toMatch(/Cookie/);
    expect(text).not.toMatch(/Cookie は(?:一切)?使(?:用|い)ま?せん/);
    // globals.css imports the webfonts, which is a request to Google too.
    expect(text).toMatch(/Google Fonts/);
  });

  it("says the data the site republishes is the official public record", () => {
    render(<PrivacyContent />);
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/ゼッケン/);
    expect(text).toMatch(/掲載/);
  });

  it("gives one way to reach the operator, and it is the Discord invite", () => {
    render(<PrivacyContent />);
    const links = screen.getAllByRole("link", { name: /Discord/ });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link).toHaveAttribute("href", DISCORD);
  });

  it("keeps the operator anonymous, because the page is not the credit line", () => {
    render(<PrivacyContent />);
    expect(document.body.textContent ?? "").not.toMatch(/Matsukura/i);
  });

  it("claims nothing about retention or server logs, which are not verifiable here", () => {
    render(<PrivacyContent />);
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/保存期間/);
    expect(text).not.toMatch(/アクセスログ(?:は|を)(?:一切)?(?:取得|保存)しま?せん/);
  });
});

describe("TermsContent", () => {
  it("names itself in the heading", () => {
    render(<TermsContent />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("利用規約");
  });

  it("disclaims any relationship with the organisers and the timing company", () => {
    render(<TermsContent />);
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/非公式/);
    expect(text).toMatch(/主催者/);
  });

  it("says the estimates are estimates and the service is offered as is", () => {
    render(<TermsContent />);
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/推定|予想/);
    expect(text).toMatch(/保証/);
  });

  it("reserves the copyright while leaving the timing data to its own holders", () => {
    render(<TermsContent />);
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/著作権/);
    expect(text).toMatch(/計測データ/);
  });

  it("asks that the API is not hammered, since the load lands on someone else", () => {
    render(<TermsContent />);
    expect(document.body.textContent ?? "").toMatch(/\/api\//);
  });

  it("carries a governing law and an effective date", () => {
    render(<TermsContent />);
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/日本法/);
    expect(text).toMatch(/2026年9月7日|2026 年 9 月 7 日/);
  });

  it("points at the Discord invite for questions", () => {
    render(<TermsContent />);
    const links = screen.getAllByRole("link", { name: /Discord/ });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link).toHaveAttribute("href", DISCORD);
  });

  it("keeps the operator anonymous here too", () => {
    render(<TermsContent />);
    expect(document.body.textContent ?? "").not.toMatch(/Matsukura/i);
  });
});
