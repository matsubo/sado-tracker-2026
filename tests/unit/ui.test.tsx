// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppHeader } from "@/components/layout/AppHeader";
import { Footer } from "@/components/layout/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { formatClock } from "@/lib/format";

afterEach(cleanup);

const TAB_ITEMS = [
  { value: "a", label: "A" },
  { value: "b", label: "B" },
  { value: "c", label: "C" },
] as const;

/** Tabs are controlled: the test owns the selection state. */
function ControlledTabs() {
  const [value, setValue] = useState<string>("a");
  return <Tabs aria-label="部門" items={TAB_ITEMS} value={value} onValueChange={setValue} />;
}

describe("Button", () => {
  it("renders its label and stays a non-submitting button by default", () => {
    render(<Button>追加</Button>);
    const button = screen.getByRole("button", { name: "追加" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("type", "button");
  });

  it("paints the brand gradient by default and lets the caller override it", () => {
    const { rerender } = render(<Button>追加</Button>);
    expect(screen.getByRole("button", { name: "追加" })).toHaveClass("bg-brand-gradient");
    rerender(<Button className="bg-muted">追加</Button>);
    expect(screen.getByRole("button", { name: "追加" })).not.toHaveClass("bg-brand-gradient");
  });

  it("calls onClick when pressed", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>追加</Button>);
    fireEvent.click(screen.getByRole("button", { name: "追加" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("Tabs", () => {
  it("marks the selected tab and keeps a single tab stop", () => {
    render(<ControlledTabs />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[0]).toHaveAttribute("tabindex", "0");
    expect(tabs[1]).toHaveAttribute("aria-selected", "false");
    expect(tabs[1]).toHaveAttribute("tabindex", "-1");
  });

  it("moves the selection with the arrow keys and wraps around", () => {
    render(<ControlledTabs />);
    const [first, second, third] = screen.getAllByRole("tab");
    if (!first || !second || !third) throw new Error("expected three tabs");

    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(second).toHaveAttribute("aria-selected", "true");
    expect(first).toHaveAttribute("aria-selected", "false");
    expect(document.activeElement).toBe(second);

    fireEvent.keyDown(second, { key: "ArrowLeft" });
    fireEvent.keyDown(first, { key: "ArrowLeft" });
    expect(third).toHaveAttribute("aria-selected", "true");
  });

  it("selects a tab on click", () => {
    render(<ControlledTabs />);
    fireEvent.click(screen.getByRole("tab", { name: "C" }));
    expect(screen.getByRole("tab", { name: "C" })).toHaveAttribute("aria-selected", "true");
  });
});

describe("Table", () => {
  it("scrolls horizontally inside its wrapper instead of widening the page", () => {
    const { container } = render(
      <Table>
        <THead>
          <TR>
            <TH align="left">名前</TH>
            <TH>タイム</TH>
          </TR>
        </THead>
        <TBody>
          <TR>
            <TD align="left">両津 美咲</TD>
            <TD>1:23:45</TD>
          </TR>
        </TBody>
      </Table>,
    );
    const wrapper = container.firstElementChild;
    expect(wrapper).toHaveClass("overflow-x-auto");
    expect(wrapper?.querySelector("table")).toBeInTheDocument();
  });

  it("right-aligns numeric cells and left-aligns labelled ones", () => {
    render(
      <Table>
        <TBody>
          <TR>
            <TD align="left">両津 美咲</TD>
            <TD>1:23:45</TD>
          </TR>
        </TBody>
      </Table>,
    );
    expect(screen.getByText("両津 美咲")).toHaveClass("text-left");
    expect(screen.getByText("1:23:45")).toHaveClass("text-right");
    expect(screen.getByText("両津 美咲")).not.toHaveAttribute("align");
  });
});

describe("Footer", () => {
  it("credits AI TRI+ and the timing provider with exact outbound links", () => {
    render(<Footer />);
    const link = screen.getByRole("link", { name: "AI TRI+" });
    expect(link).toHaveAttribute("href", "https://ai-triathlon-result.teraren.com/");
    expect(link).toHaveTextContent(/^AI TRI\+$/);
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("link", { name: "systemway.jp" })).toHaveAttribute(
      "href",
      "https://systemway.jp/26sado?di=1",
    );
  });
});

describe("AppHeader", () => {
  const UPDATED_AT = Date.UTC(2026, 8, 6, 1, 32, 15);

  it("shows the title, the formatted update time and the countdown", () => {
    render(
      <AppHeader
        title="佐渡トラッカー"
        subtitle="2026"
        updatedAt={UPDATED_AT}
        stale={false}
        nextInMs={45_000}
      />,
    );
    expect(screen.getByText("佐渡トラッカー")).toBeInTheDocument();
    expect(screen.getByText(`最終更新 ${formatClock(UPDATED_AT)}`)).toBeInTheDocument();
    expect(screen.getByText("45 秒後に更新")).toBeInTheDocument();
  });

  it("marks the stale state on the status dot and in the text", () => {
    const { container } = render(
      <AppHeader title="佐渡トラッカー" updatedAt={UPDATED_AT} stale nextInMs={null} />,
    );
    expect(screen.getByText(`最終更新 ${formatClock(UPDATED_AT)}（再取得中）`)).toBeInTheDocument();
    expect(container.querySelector('[data-stale="true"]')).toBeInTheDocument();
    expect(screen.queryByText(/秒後に更新/)).not.toBeInTheDocument();
  });

  it("waits for the first fetch before showing a time", () => {
    render(<AppHeader title="佐渡トラッカー" updatedAt={null} stale={false} nextInMs={null} />);
    expect(screen.getByText("更新待ち")).toBeInTheDocument();
  });
});

describe("Select and Badge", () => {
  it("reports the chosen option through onValueChange", () => {
    const onValueChange = vi.fn();
    render(
      <Select
        aria-label="年齢区分"
        value="all"
        onValueChange={onValueChange}
        options={[
          { value: "all", label: "全て" },
          { value: "f45", label: "女子45-49" },
        ]}
      />,
    );
    fireEvent.change(screen.getByRole("combobox", { name: "年齢区分" }), {
      target: { value: "f45" },
    });
    expect(onValueChange).toHaveBeenCalledWith("f45");
  });

  it("paints sport badges with the sport custom properties", () => {
    render(<Badge variant="swim">スイム中</Badge>);
    expect(screen.getByText("スイム中")).toHaveClass("text-[color:var(--swim)]");
  });
});
