import { describe, expect, it } from "vitest";
import type { RaceStateDto } from "@/lib/api/contract";
import { waveStartSentence } from "@/lib/format";

type Division = RaceStateDto["divisions"][number];

function division(id: Division["id"], entrants: number, waveStart: string): Division {
  return {
    id,
    label: `${id}タイプ`,
    entrants,
    racing: 0,
    waveStart,
    swimKm: id === "A" || id === "RA" ? 2.0 : 1.0,
    checkpoints: [],
  };
}

function race(divisions: readonly Division[]): RaceStateDto {
  return {
    year: 2026,
    fetchedAt: 0,
    now: 0,
    stale: false,
    replay: false,
    pollIntervalMs: 60_000,
    finalResults: false,
    raceDate: "2026-09-06",
    counts: { A: {}, B: {}, RA: {}, RB: {} },
    divisions,
    _links: { self: { href: "/api/race" } },
  };
}

describe("waveStartSentence", () => {
  it("names each wave and the time it goes off", () => {
    const sentence = waveStartSentence(
      race([
        division("A", 1026, "06:30"),
        division("B", 700, "08:00"),
        division("RA", 40, "06:30"),
        division("RB", 30, "08:00"),
      ]),
    );
    expect(sentence).toBe("Aタイプは 06:30、Bタイプは 08:00 にスタートします。");
  });

  it("follows the config rather than a time written into the page", () => {
    const sentence = waveStartSentence(
      race([division("A", 1000, "06:00"), division("B", 700, "07:30")]),
    );
    expect(sentence).toBe("Aタイプは 06:00、Bタイプは 07:30 にスタートします。");
  });

  it("leaves out a wave nobody entered", () => {
    const sentence = waveStartSentence(
      race([division("A", 1000, "06:30"), division("B", 0, "08:00")]),
    );
    expect(sentence).toBe("Aタイプは 06:30 にスタートします。");
  });

  it("says nothing before the entry list is known", () => {
    expect(waveStartSentence(null)).toBeNull();
    expect(waveStartSentence(race([division("A", 0, "06:30")]))).toBeNull();
  });
});
