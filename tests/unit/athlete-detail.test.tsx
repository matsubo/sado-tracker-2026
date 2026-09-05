// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AthleteDetailDto,
  DisciplineDto,
  MapEntryDto,
  PositionDto,
  RaceStateDto,
  RankSetDto,
  SplitDto,
} from "@/lib/api/contract";

vi.mock("@/components/tracker/RankChart", () => ({
  RankChart: (): null => null,
}));

const { AthleteDetail } = await import("@/components/tracker/AthleteDetail");

/** 2026-09-06 06:00 in Asia/Tokyo. */
const START_AT = Date.UTC(2026, 8, 5, 21, 0, 0);
const SWIM_MS = 5_025_000;
const T1_MS = 5_517_000;
const SUMIYOSHI_MS = 15_154_000;
const BIKE_MS = 10_129_000;
const AI_TRI_HREF = "https://ai-triathlon-result.teraren.com/athletes/misaki";

const EMPTY_RANKS: RankSetDto = { division: null, sex: null, ageGroup: null };

const ranks = (rank: number, of: number): RankSetDto => ({
  division: { rank, of },
  sex: null,
  ageGroup: null,
});

/** A discipline row, defaulting to "no time yet". */
const leg = (
  over: Partial<DisciplineDto> & Pick<DisciplineDto, "discipline" | "label" | "km">,
): DisciplineDto => ({
  timeMs: null,
  provisional: false,
  atCheckpointLabel: null,
  ranks: EMPTY_RANKS,
  deviation: null,
  speedKmh: null,
  ...over,
});

/** Somewhere on the bike leg, having last been measured at 住吉. */
const onBike = (estKm: number, lastAt: number, speedKmh: number): PositionDto => ({
  discipline: "bike",
  lastCheckpointLabel: "住吉",
  lastKm: 100,
  lastAt,
  speedKmh,
  capKm: 190,
  estKm,
  totalKm: 190,
  waiting: false,
  inTransition: false,
  source: "own",
});

/** A split, with the pass time derived from the elapsed time. */
const split = (
  over: Partial<SplitDto> &
    Pick<SplitDto, "checkpointId" | "label" | "discipline" | "km" | "elapsedMs">,
): SplitDto => ({
  kmInferred: false,
  segmentMs: null,
  segmentKm: null,
  segmentSpeedKmh: null,
  segmentRank: null,
  cumulativeRanks: EMPTY_RANKS,
  passedAt: START_AT + over.elapsedMs,
  ...over,
});

/** An age-group rival on the course strip. */
const neighbour = (
  bib: string,
  name: string,
  rank: number,
  position: PositionDto,
  isSelf?: true,
): MapEntryDto => ({
  bib,
  name,
  ageGroupId: "F45-49",
  status: "racing",
  fieldOrder: rank,
  divisionRank: { rank, of: 412 },
  position,
  ...(isSelf === undefined ? {} : { isSelf }),
});

const raceState: RaceStateDto = {
  year: 2026,
  fetchedAt: 1_757_000_000_000,
  stale: false,
  replay: false,
  counts: { A: {}, B: {}, RA: {}, RB: {} },
  divisions: [
    {
      id: "A",
      label: "Aタイプ",
      entrants: 1004,
      checkpoints: [
        { id: "swimF", label: "スイムF", km: 4, discipline: "swim" },
        { id: "bikeS", label: "バイクS", km: 0, discipline: "bike" },
        { id: "sumiyoshi", label: "住吉", km: 100, discipline: "bike" },
        { id: "runS", label: "ランS（本部）", km: 190, discipline: "bike" },
        { id: "finish", label: "FINISH", km: 42.2, discipline: "run" },
      ],
    },
  ],
  _links: { self: { href: "/api/race" } },
};

const detail: AthleteDetailDto = {
  bib: "1234",
  name: "両津 美咲",
  division: "A",
  ageGroupId: "F45-49",
  ageGroupLabel: "女子45-49",
  sex: "F",
  status: "racing",
  startAt: START_AT,
  lastCheckpointLabel: "住吉",
  lastPassedAt: START_AT + SUMIYOSHI_MS,
  elapsedMs: SUMIYOSHI_MS,
  totalRanks: {
    division: { rank: 198, of: 412 },
    sex: { rank: 19, of: 88 },
    ageGroup: { rank: 7, of: 23 },
  },
  disciplines: [
    leg({
      discipline: "swim",
      label: "スイム",
      km: 4,
      timeMs: SWIM_MS,
      ranks: ranks(234, 980),
      deviation: 54,
    }),
    leg({
      discipline: "bike",
      label: "バイク",
      km: 190,
      timeMs: BIKE_MS,
      provisional: true,
      atCheckpointLabel: "住吉",
      ranks: ranks(201, 412),
      deviation: 56,
      speedKmh: 37.3,
    }),
    leg({ discipline: "run", label: "ラン", km: 42.2 }),
  ],
  position: onBike(132, START_AT + SUMIYOSHI_MS, 32.1),
  prediction: {
    method: "neighbours",
    atCheckpointLabel: "住吉",
    finishAt: START_AT + 47_520_000,
    totalMs: 47_520_000,
    rangeLowMs: 46_800_000,
    rangeHighMs: 49_500_000,
    explanation: {
      neighbourCount: 20,
      yearBreakdown: { "2025": 9, "2024": 6, "2023": 5 },
      remainingP25Ms: 31_020_000,
      remainingMedianMs: 32_366_000,
      remainingP75Ms: 33_720_000,
      ownSpeedKmh: 32.1,
      neighbourSpeedKmh: 31.4,
      extrapolationMs: 48_300_000,
      backtestMedianErrorMs: 1_080_000,
      backtestWithin25MinPct: 52,
      note: "住吉からランSまでは向かい風の影響が大きい区間です。",
    },
  },
  officialTotal: null,
  remark: "",
  splits: [
    split({
      checkpointId: "swimF",
      label: "スイムF",
      discipline: "swim",
      km: 4,
      elapsedMs: SWIM_MS,
      segmentMs: SWIM_MS,
      segmentKm: 4,
      segmentRank: { rank: 228, of: 980 },
    }),
    split({
      checkpointId: "bikeS",
      label: "バイクS",
      discipline: "transition",
      km: 0,
      elapsedMs: T1_MS,
      segmentMs: T1_MS - SWIM_MS,
    }),
    split({
      checkpointId: "sumiyoshi",
      label: "住吉",
      discipline: "bike",
      km: 100,
      kmInferred: true,
      elapsedMs: SUMIYOSHI_MS,
      segmentMs: SUMIYOSHI_MS - T1_MS,
      segmentKm: 100,
      segmentSpeedKmh: 37.3,
      segmentRank: { rank: 201, of: 412 },
    }),
  ],
  rankHistory: [
    { checkpointId: "swimF", label: "スイムF", ranks: ranks(234, 980) },
    { checkpointId: "sumiyoshi", label: "住吉", ranks: ranks(198, 412) },
  ],
  pastResults: [],
  neighbours: [
    neighbour("1200", "畑野 結衣", 150, onBike(143, START_AT + SUMIYOSHI_MS - 600_000, 33.4)),
    neighbour("1234", "両津 美咲", 198, onBike(132, START_AT + SUMIYOSHI_MS, 32.1), true),
  ],
  _links: {
    self: { href: "/api/athletes/1234" },
    page: { href: "/athletes/1234" },
    aiTri: { href: AI_TRI_HREF },
  },
};

/** Serves the race endpoint and the athlete endpoint from the fixtures above. */
function stubFetch(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes("/api/race") ? raceState : detail;
      return { ok: true, status: 200, json: async () => body } as unknown as Response;
    }),
  );
}

/** Renders the page and waits for the athlete data to land. */
async function renderDetail(): Promise<void> {
  render(<AthleteDetail bib="1234" />);
  await screen.findByRole("heading", { level: 1 });
}

/** The tile whose label matches, as an element its values can be searched in. */
function tile(label: string): HTMLElement {
  const heading = screen.getByText(label);
  const parent = heading.parentElement;
  if (parent === null) throw new Error(`tile ${label} has no container`);
  return parent;
}

/** The table row containing the given label cell. */
function row(label: string): HTMLElement {
  const cell = screen.getByText(label).closest("tr");
  if (cell === null) throw new Error(`no row for ${label}`);
  return cell;
}

describe("AthleteDetail", () => {
  beforeEach(() => {
    stubFetch();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps the prediction explanation collapsed until the ? button is pressed", async () => {
    await renderDetail();
    const button = screen.getByRole("button", { name: "予想ゴールの計算方法を表示" });

    expect(screen.queryByText("近傍 20 人法")).not.toBeInTheDocument();
    expect(screen.queryByText("どう計算したか")).not.toBeInTheDocument();
    expect(button).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(button);

    expect(screen.getByText("近傍 20 人法")).toBeInTheDocument();
    expect(screen.getByText("どう計算したか")).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it("shows the neighbour distribution and the closing note once expanded", async () => {
    await renderDetail();
    fireEvent.click(screen.getByRole("button", { name: "予想ゴールの計算方法を表示" }));

    expect(screen.getByText("近傍の残り時間")).toBeInTheDocument();
    expect(screen.getByText("2025: 9 人 · 2024: 6 人 · 2023: 5 人")).toBeInTheDocument();
    expect(screen.getByText("中央値 18 分 · 52% が ±25 分以内")).toBeInTheDocument();
    expect(screen.getByText(detail.prediction?.explanation.note ?? "")).toBeInTheDocument();
  });

  it("marks a discipline still in progress as 暫定", async () => {
    await renderDetail();
    expect(within(row("バイク 190km")).getByText("暫定")).toBeInTheDocument();
  });

  it("renders an em dash for a discipline with no time yet", async () => {
    await renderDetail();
    expect(within(row("ラン 42.2km")).getAllByText("—").length).toBeGreaterThan(0);
  });

  it("renders the empty state when there are no past results", async () => {
    await renderDetail();
    expect(screen.getByText("過去 4 年の完走記録は見つかりませんでした。")).toBeInTheDocument();
  });

  it("links to the AI TRI+ athlete page in a new tab", async () => {
    await renderDetail();
    const link = screen.getByRole("link", { name: "AI TRI+ の選手ページ ↗" });
    expect(link).toHaveAttribute("href", AI_TRI_HREF);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows each current rank with the size of the field it was taken from", async () => {
    await renderDetail();

    const division = tile("部門 · 住吉時点");
    expect(within(division).getByText("198")).toBeInTheDocument();
    expect(within(division).getByText("/412")).toBeInTheDocument();

    const sex = tile("女子");
    expect(within(sex).getByText("19")).toBeInTheDocument();
    expect(within(sex).getByText("/88")).toBeInTheDocument();

    const age = tile("エイジ 女子45-49");
    expect(within(age).getByText("7")).toBeInTheDocument();
    expect(within(age).getByText("/23")).toBeInTheDocument();
  });
});
