// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { FinalResultsNotice } from "@/components/tracker/FinalResultsNotice";
import { LiveStatusBar } from "@/components/tracker/LiveStatusBar";
import type { RaceStateDto } from "@/lib/api/contract";

afterEach(cleanup);

const RACE: RaceStateDto = {
  year: 2026,
  fetchedAt: Date.parse("2026-09-07T09:39:00+09:00"),
  now: Date.parse("2026-09-07T10:00:00+09:00"),
  stale: false,
  replay: false,
  pollIntervalMs: 60_000,
  finalResults: true,
  raceDate: "2026-09-06",
  counts: { A: { finish: 814 }, B: { finish: 665 }, RA: {}, RB: {} },
  divisions: [
    {
      id: "A",
      label: "Aタイプ",
      entrants: 1026,
      racing: 953,
      waveStart: "06:30",
      swimKm: 2,
      checkpoints: [],
    },
    {
      id: "B",
      label: "Bタイプ",
      entrants: 777,
      racing: 696,
      waveStart: "08:00",
      swimKm: 1,
      checkpoints: [],
    },
    {
      id: "RA",
      label: "RA",
      entrants: 0,
      racing: 0,
      waveStart: "06:30",
      swimKm: 2,
      checkpoints: [],
    },
    {
      id: "RB",
      label: "RB",
      entrants: 0,
      racing: 0,
      waveStart: "08:00",
      swimKm: 1,
      checkpoints: [],
    },
  ],
  _links: { self: { href: "/api/race" } },
};

const LIVE: RaceStateDto = { ...RACE, finalResults: false };

describe("once the race is over", () => {
  it("says the results are final, dated by the race and not by the last fetch", () => {
    render(<LiveStatusBar race={RACE} lastPolledAt={RACE.now} error={null} />);
    expect(screen.getByText("最終結果")).toBeInTheDocument();
    expect(screen.getByText("2026年9月6日")).toBeInTheDocument();
  });

  it("drops the countdown and the automatic refresh control", () => {
    render(
      <LiveStatusBar
        race={RACE}
        lastPolledAt={RACE.now}
        error={null}
        auto
        onAutoChange={() => {}}
        onRefresh={() => {}}
      />,
    );
    expect(screen.queryByLabelText("いま更新する")).not.toBeInTheDocument();
    expect(screen.queryByText("自動更新")).not.toBeInTheDocument();
  });

  it("keeps the clock and the controls while the race is on", () => {
    render(
      <LiveStatusBar
        race={LIVE}
        lastPolledAt={LIVE.now}
        error={null}
        auto
        onAutoChange={() => {}}
        onRefresh={() => {}}
      />,
    );
    expect(screen.queryByText("最終結果")).not.toBeInTheDocument();
    expect(screen.getByLabelText("いま更新する")).toBeInTheDocument();
    expect(screen.getByText("自動更新")).toBeInTheDocument();
  });

  it("tells a reader arriving later that the page is a record", () => {
    render(<FinalResultsNotice race={RACE} />);
    expect(screen.getByText(/2026 年大会は終了しました/)).toBeInTheDocument();
    expect(screen.getByText(/Aタイプ 814 名/)).toBeInTheDocument();
    expect(screen.getByText(/Bタイプ 665 名/)).toBeInTheDocument();
  });

  it("says nothing while the race is still on", () => {
    const { container } = render(<FinalResultsNotice race={LIVE} />);
    expect(container).toBeEmptyDOMElement();
  });
});
