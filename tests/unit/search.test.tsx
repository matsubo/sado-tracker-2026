// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchBox } from "@/components/tracker/SearchBox";
import type { AthleteSummaryDto } from "@/lib/api/contract";

function athlete(
  bib: string,
  name: string,
  extra: Partial<AthleteSummaryDto> = {},
): AthleteSummaryDto {
  return {
    bib,
    name,
    division: "A",
    ageGroupId: "M55-59",
    ageGroupLabel: "男子55-59",
    sex: "M",
    status: "racing",
    startAt: 0,
    lastCheckpointLabel: "住吉",
    lastPassedAt: 1,
    elapsedMs: 1,
    totalRanks: { division: null, sex: null, ageGroup: null },
    disciplines: [],
    position: {
      discipline: "bike",
      lastCheckpointLabel: "住吉",
      lastKm: 100,
      lastAt: 0,
      speedKmh: 25,
      capKm: 190,
      estKm: 120,
      totalKm: 190,
      waiting: false,
      inTransition: false,
      source: "own",
    },
    prediction: null,
    officialTotal: null,
    remark: "",
    _links: { self: { href: `/api/athletes/${bib}` } },
    ...extra,
  };
}

const MATCHES = [
  athlete("1597", "井上　伸一"),
  athlete("1858", "井上　盛文"),
  athlete("1035", "井上　航"),
];

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify({
          count: MATCHES.length,
          athletes: url.includes("q=") ? MATCHES : [],
          missing: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SearchBox suggestions", () => {
  it("shows nothing until the reader types", () => {
    render(<SearchBox onAdd={() => {}} isAdded={() => false} />);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("suggests athletes while typing, without a submit", async () => {
    render(<SearchBox onAdd={() => {}} isAdded={() => false} />);
    fireEvent.change(screen.getByLabelText("ゼッケン番号か名前で選手を検索"), {
      target: { value: "井上" },
    });

    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument());
    expect(screen.getAllByRole("option")).toHaveLength(3);
    // The typed part is wrapped for emphasis, and the matcher normalises the
    // ideographic space, so assert on the two halves of the name.
    const first = screen.getAllByRole("option")[0] as HTMLElement;
    expect(first).toHaveTextContent("井上");
    expect(first).toHaveTextContent("伸一");
  });

  it("shows enough to tell two people with the same name apart", async () => {
    render(<SearchBox onAdd={() => {}} isAdded={() => false} />);
    fireEvent.change(screen.getByLabelText("ゼッケン番号か名前で選手を検索"), {
      target: { value: "井上" },
    });
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument());

    const first = screen.getAllByRole("option")[0] as HTMLElement;
    expect(first).toHaveTextContent("1597");
    expect(first).toHaveTextContent("男子55-59");
    expect(first).toHaveTextContent("住吉");
  });

  it("adds the athlete the reader picks and clears the box", async () => {
    const onAdd = vi.fn();
    render(<SearchBox onAdd={onAdd} isAdded={() => false} />);
    const input = screen.getByLabelText("ゼッケン番号か名前で選手を検索");
    fireEvent.change(input, { target: { value: "井上" } });
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole("option")[1] as HTMLElement);
    expect(onAdd).toHaveBeenCalledWith("1858");
    expect(input).toHaveValue("");
  });

  it("moves through the list with the arrow keys and picks with Enter", async () => {
    const onAdd = vi.fn();
    render(<SearchBox onAdd={onAdd} isAdded={() => false} />);
    const input = screen.getByLabelText("ゼッケン番号か名前で選手を検索");
    fireEvent.change(input, { target: { value: "井上" } });
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument());

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onAdd).toHaveBeenCalledWith("1035");
  });

  it("wraps around at the ends of the list", async () => {
    const onAdd = vi.fn();
    render(<SearchBox onAdd={onAdd} isAdded={() => false} />);
    const input = screen.getByLabelText("ゼッケン番号か名前で選手を検索");
    fireEvent.change(input, { target: { value: "井上" } });
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument());

    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onAdd).toHaveBeenCalledWith("1035");
  });

  it("marks an athlete already on the list and does not add them twice", async () => {
    const onAdd = vi.fn();
    render(<SearchBox onAdd={onAdd} isAdded={(bib) => bib === "1597"} />);
    fireEvent.change(screen.getByLabelText("ゼッケン番号か名前で選手を検索"), {
      target: { value: "井上" },
    });
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument());

    const first = screen.getAllByRole("option")[0] as HTMLElement;
    expect(first).toHaveTextContent("登録済み");
    fireEvent.click(first);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("says so plainly when nothing matches", async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify({ count: 0, athletes: [], missing: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    render(<SearchBox onAdd={() => {}} isAdded={() => false} />);
    fireEvent.change(screen.getByLabelText("ゼッケン番号か名前で選手を検索"), {
      target: { value: "存在しない" },
    });

    await waitFor(() => expect(screen.getByText(/一致する選手はいません/)).toBeInTheDocument());
  });

  it("closes the list on Escape", async () => {
    render(<SearchBox onAdd={() => {}} isAdded={() => false} />);
    const input = screen.getByLabelText("ゼッケン番号か名前で選手を検索");
    fireEvent.change(input, { target: { value: "井上" } });
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument());

    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("issues one request per pause, not one per keystroke", async () => {
    render(<SearchBox onAdd={() => {}} isAdded={() => false} />);
    const input = screen.getByLabelText("ゼッケン番号か名前で選手を検索");
    for (const value of ["井", "井上", "井上 伸"]) {
      fireEvent.change(input, { target: { value } });
    }
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("bookmark analytics", () => {
  it("reports an add once, with the screen it came from", async () => {
    const gtag = vi.fn();
    vi.stubGlobal("gtag", gtag);
    const { track } = await import("@/lib/analytics");

    track("bookmark_add", { source: "search" });
    expect(gtag).toHaveBeenCalledWith("event", "bookmark_add", { source: "search" });

    track("bookmark_remove", { source: "card" });
    expect(gtag).toHaveBeenCalledWith("event", "bookmark_remove", { source: "card" });
    expect(gtag).toHaveBeenCalledTimes(2);
  });

  it("stays silent when analytics is switched off", async () => {
    vi.unstubAllGlobals();
    const { track } = await import("@/lib/analytics");
    // No gtag on the page: nothing is sent and nothing throws.
    expect(() => track("bookmark_add", { source: "search" })).not.toThrow();
  });
});
