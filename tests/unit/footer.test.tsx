// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { Footer } from "@/components/layout/Footer";
import { NAV_LINKS } from "@/components/layout/navLinks";

afterEach(cleanup);

describe("Footer", () => {
  it("lists every destination the menu lists", () => {
    render(<Footer />);
    const nav = screen.getByRole("navigation", { name: "サイト内のページ" });
    for (const link of NAV_LINKS) {
      const anchor = within(nav).getByRole("link", { name: link.label });
      expect(anchor).toHaveAttribute("href", link.href);
    }
  });

  it("sends the reader to the official timing site in a new tab", () => {
    render(<Footer />);
    const official = screen.getAllByRole("link", { name: /公式計測サイト/ })[0];
    expect(official).toHaveAttribute("target", "_blank");
    expect(official).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("keeps the credit and the way to report a problem", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: "AI TRI+" })).toHaveAttribute(
      "href",
      "https://ai-triathlon-result.teraren.com/",
    );
    expect(screen.getByRole("link", { name: /不具合の報告/ })).toHaveAttribute(
      "href",
      "https://github.com/matsubo/sado-tracker-2026",
    );
  });

  it("reserves copyright, because reading the source is not reusing it", () => {
    render(<Footer />);
    expect(screen.getByText(/All rights reserved/)).toBeInTheDocument();
  });

  it("offers the share buttons", () => {
    render(<Footer />);
    for (const name of ["X で共有", "Facebook で共有", "LINE で共有"]) {
      expect(screen.getByLabelText(name)).toBeInTheDocument();
    }
  });
});
