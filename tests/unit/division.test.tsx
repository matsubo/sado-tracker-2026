// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DivisionRankings } from "@/components/tracker/DivisionRankings";
import { FieldMap } from "@/components/tracker/FieldMap";
import type {
  MapEntryDto,
  PositionDto,
  RaceStateDto,
  RankingPageDto,
  RankingRowDto,
} from "@/lib/api/contract";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const CHECKPOINTS = [
  { id: "swimF", label: "スイムF", km: 4, discipline: "swim" },
  { id: "bikeS", label: "バイクS", km: 0, discipline: "bike" },
  { id: "sumiyoshi", label: "住吉", km: 100, discipline: "bike" },
  { id: "runS", label: "ランS（本部）", km: 190, discipline: "bike" },
  { id: "run10", label: "ラン10km", km: 10, discipline: "run" },
  { id: "finish", label: "FINISH", km: 42.2, discipline: "run" },
];

const RACE: RaceStateDto = {
  year: 2026,
  fetchedAt: 1_000,
  stale: false,
  replay: false,
  counts: { A: {}, B: {}, RA: {}, RB: {} },
  divisions: [
    { id: "A", label: "Aタイプ", entrants: 3, checkpoints: CHECKPOINTS },
    { id: "B", label: "Bタイプ", entrants: 0, checkpoints: [] },
    { id: "RA", label: "RAタイプ", entrants: 0, checkpoints: [] },
    { id: "RB", label: "RBタイプ", entrants: 0, checkpoints: [] },
  ],
  _links: { self: { href: "/api/race" } },
};

function row(partial: Partial<RankingRowDto> & Pick<RankingRowDto, "rank" | "bib">): RankingRowDto {
  return {
    name: `選手${partial.bib}`,
    ageGroupId: "F45-49",
    timeMs: 5_000_000,
    paceText: "2:05 /100m",
    diffMs: null,
    isTarget: false,
    ...partial,
  };
}

function page(partial: Partial<RankingPageDto> = {}): RankingPageDto {
  return {
    division: "A",
    discipline: "swim",
    ageGroupId: null,
    measuredAt: "スイム完了",
    total: 3,
    page: 1,
    perPage: 50,
    rows: [
      row({ rank: 11, bib: "1111", name: "畑野 結衣", diffMs: -35_000 }),
      row({ rank: 12, bib: "1234", name: "両津 美咲", diffMs: 0, isTarget: true }),
      row({ rank: 13, bib: "1313", name: "新穂 楓", diffMs: 133_000 }),
    ],
    targetElsewhere: null,
    _links: { self: { href: "/api/divisions/A/rankings" } },
    ...partial,
  };
}

function position(discipline: "swim" | "bike" | "run", estKm: number, waiting: boolean): PositionDto {
  return {
    discipline,
    lastCheckpointLabel: null,
    lastKm: estKm,
    lastAt: 1_000,
    speedKmh: 0,
    capKm: estKm,
    estKm,
    totalKm: 190,
    waiting,
    inTransition: false,
    source: "own",
  };
}

function entry(partial: Partial<MapEntryDto> & Pick<MapEntryDto, "bib" | "name">): MapEntryDto {
  return {
    ageGroupId: "F45-49",
    status: "racing",
    fieldOrder: 0,
    divisionRank: { rank: 198, of: 412 },
    position: position("bike", 132, false),
    ...partial,
  };
}

const MAP_BODY = {
  division: "A",
  ageGroupId: null,
  fetchedAt: 1_000,
  count: 3,
  entries: [
    entry({ bib: "9001", name: "佐和田 蓮", position: position("run", 8.4, true) }),
    entry({ bib: "1234", name: "両津 美咲", isSelf: true }),
    entry({ bib: "9003", name: "真野 凪", position: position("swim", 2.1, false) }),
  ],
  _links: { self: { href: "/api/map?div=A" } },
};

let rankingBody: RankingPageDto = page();

function stubFetch(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string | URL) => {
      const url = String(input);
      if (url.includes("/api/race")) return Promise.resolve(new Response(JSON.stringify(RACE)));
      if (url.includes("/api/map")) return Promise.resolve(new Response(JSON.stringify(MAP_BODY)));
      return Promise.resolve(new Response(JSON.stringify(rankingBody)));
    }),
  );
}

/** URLs of every fetch made so far, for asserting on query strings. */
const fetchedUrls = (): string[] =>
  vi.mocked(globalThis.fetch).mock.calls.map((call) => String(call[0]));

beforeEach(() => {
  rankingBody = page();
  window.history.replaceState(null, "", "/");
  stubFetch();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderRankings(bib: string | null = null) {
  return render(
    <DivisionRankings
      division="A"
      initialDiscipline="swim"
      initialAgeGroup={null}
      initialBib={bib}
      initialPage={1}
    />,
  );
}

describe("DivisionRankings", () => {
  it("renders the rows in rank order", async () => {
    const { container } = renderRankings();
    await screen.findByText("両津 美咲");

    const ranks = [...container.querySelectorAll("tbody tr td:first-child")].map(
      (cell) => cell.textContent,
    );
    expect(ranks).toEqual(["11", "12", "13"]);
  });

  it("highlights the target row", async () => {
    const { container } = renderRankings("1234");
    await screen.findByText("両津 美咲");

    const rows = [...container.querySelectorAll("tbody tr")];
    const target = rows.find((element) => element.textContent?.includes("両津 美咲"));
    expect(target?.className).toContain("--highlight");
    expect(rows[0]?.className).not.toContain("--highlight");
  });

  it("renders a negative difference with a minus sign and the good colour", async () => {
    const { container } = renderRankings("1234");
    await screen.findByText("畑野 結衣");

    const faster = [...container.querySelectorAll("tbody tr")].find((element) =>
      element.textContent?.includes("畑野 結衣"),
    );
    const diff = faster?.querySelector("td:last-child");
    expect(diff?.textContent).toBe("−0:35");
    expect(diff?.className).toContain("--good");
  });

  it("disables 前へ on the first page", async () => {
    renderRankings();
    await screen.findByText("両津 美咲");

    expect(screen.getByRole("button", { name: "‹ 前へ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "次へ ›" })).toBeDisabled();
  });

  it("renders the targetElsewhere banner", async () => {
    const message = "両津 美咲 は 住吉 を通過。バイク完了者の表にはまだ入っていません";
    rankingBody = page({ targetElsewhere: { bib: "1234", name: "両津 美咲", message } });

    renderRankings("1234");
    expect(await screen.findByRole("status")).toHaveTextContent(message);
  });

  it("refetches with discipline=bike when the discipline tab changes", async () => {
    renderRankings();
    await screen.findByText("両津 美咲");

    fireEvent.click(screen.getByRole("tab", { name: "バイク" }));

    await waitFor(() => {
      expect(fetchedUrls().some((url) => url.includes("discipline=bike"))).toBe(true);
    });
  });
});

describe("FieldMap", () => {
  it("renders one dot per entry and names the bookmarked athlete", async () => {
    // Bookmarks come from the shareable `?bibs=` link as well as local storage.
    window.history.replaceState(null, "", "/map?bibs=1234");

    const { container } = render(<FieldMap initialDivision="A" />);
    await screen.findByText(/両津 美咲/);

    expect(container.querySelectorAll("svg circle")).toHaveLength(MAP_BODY.entries.length);
    expect(fetchedUrls().some((url) => url.includes("/api/map?div=A&bibs=1234"))).toBe(true);
  });
});
