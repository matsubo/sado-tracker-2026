import { describe, expect, it } from "vitest";
import { getRaceConfig } from "@/config/races";
import { derivePassEvents, eventKey } from "@/lib/compute/events";
import { computeSnapshot } from "@/lib/compute/snapshot";
import { buildNeighbourModel } from "@/lib/history/model";
import { buildNameIndex, type HistoryYear } from "@/lib/history/nameIndex";
import { loadFixtureSnapshot } from "@/lib/testing/fixtures";

const YEARS: HistoryYear[] = [2023, 2024].map((year) => ({
  year,
  snapshot: loadFixtureSnapshot(year, Date.parse(`${year}-09-30T00:00:00+09:00`)),
  config: getRaceConfig(year),
}));

const config = getRaceConfig(2025);
const model = buildNeighbourModel(YEARS, config);
const nameIndex = buildNameIndex(YEARS);

/** Mid-race on the 2025 course: the A field is spread over the bike leg. */
const MID_RACE = Date.parse("2025-09-07T13:00:00+09:00");

function build(nowMs = MID_RACE) {
  const raw = loadFixtureSnapshot(2025, nowMs);
  const visible = {
    ...raw,
    athletes: raw.athletes.map((a) => ({
      ...a,
      passes: Object.fromEntries(Object.entries(a.passes).filter(([, at]) => at <= nowMs)),
    })),
  };
  return computeSnapshot(visible, config, model, nameIndex, nowMs);
}

describe("computeSnapshot", () => {
  const snapshot = build();

  it("covers every athlete", () => {
    expect(snapshot.athletes.size).toBeGreaterThan(1700);
  });

  it("counts the field at each checkpoint per division", () => {
    expect(snapshot.counts.A.swimF).toBeGreaterThan(700);
    expect(snapshot.counts.A.finish ?? 0).toBe(0);
    expect(snapshot.counts.B.finish).toBeGreaterThan(0);
  });

  it("orders the field so the leader comes first", () => {
    const leader = snapshot.athletes.get(snapshot.byDivision.A[0] as string);
    const trailer = snapshot.athletes.get(snapshot.byDivision.A.at(-1) as string);
    expect(leader?.fieldOrder).toBe(0);
    expect(leader?.position.estKm).toBeGreaterThan(trailer?.position.estKm as number);
  });

  it("never lets an estimated position exceed the leg distance", () => {
    for (const computed of snapshot.athletes.values()) {
      expect(computed.position.estKm).toBeLessThanOrEqual(computed.position.totalKm);
      expect(computed.position.estKm).toBeGreaterThanOrEqual(0);
    }
  });

  it("gives every racing athlete on the bike a prediction", () => {
    const onBike = [...snapshot.athletes.values()].filter(
      (c) =>
        c.status === "racing" && c.position.discipline === "bike" && c.lastCheckpointId !== null,
    );
    expect(onBike.length).toBeGreaterThan(100);
    const withPrediction = onBike.filter((c) => c.prediction !== null);
    expect(withPrediction.length / onBike.length).toBeGreaterThan(0.9);
  });

  it("keeps every prediction inside its own range", () => {
    for (const computed of snapshot.athletes.values()) {
      const p = computed.prediction;
      if (!p) continue;
      expect(p.rangeLowMs).toBeLessThanOrEqual(p.totalMs);
      expect(p.rangeHighMs).toBeGreaterThanOrEqual(p.totalMs);
      expect(p.finishAt).toBeGreaterThan(computed.athlete.startAt);
    }
  });

  it("agrees between the rank shown and the population counted", () => {
    for (const computed of snapshot.athletes.values()) {
      const rank = computed.totalRanks.division;
      if (!rank) continue;
      expect(rank.rank).toBeGreaterThanOrEqual(1);
      expect(rank.rank).toBeLessThanOrEqual(rank.of);
      expect(rank.of).toBe(
        snapshot.counts[computed.athlete.division][computed.lastCheckpointId as string],
      );
    }
  });

  it("marks suspected no-shows rather than leaving them at the start line", () => {
    const noShows = [...snapshot.athletes.values()].filter((c) => c.status === "dns_suspected");
    expect(noShows.length).toBeGreaterThan(100);
    for (const noShow of noShows) {
      expect(snapshot.byDivision[noShow.athlete.division]).not.toContain(noShow.athlete.bib);
    }
  });

  it("finishes inside the poll interval", () => {
    const started = performance.now();
    build(MID_RACE + 60_000);
    // The poller runs every 60 seconds; a whole recomputation of 1,800
    // athletes has to fit comfortably inside that, even on a shared runner.
    expect(performance.now() - started).toBeLessThan(20_000);
  }, 60_000);
});

describe("derivePassEvents", () => {
  const snapshot = build();

  it("returns the checkpoints of the requested athletes, newest first", () => {
    const bib = snapshot.byDivision.A[0] as string;
    const events = derivePassEvents(snapshot, [bib]);
    expect(events.length).toBeGreaterThan(0);
    for (let i = 1; i < events.length; i += 1) {
      expect((events[i - 1] as { passedAt: number }).passedAt).toBeGreaterThanOrEqual(
        (events[i] as { passedAt: number }).passedAt,
      );
    }
  });

  it("carries the rank at the moment of the pass", () => {
    const bib = snapshot.byDivision.A[0] as string;
    const event = derivePassEvents(snapshot, [bib])[0];
    expect(event?.divisionRank?.of).toBeGreaterThan(0);
  });

  it("ignores an unknown bib", () => {
    expect(derivePassEvents(snapshot, ["nope"])).toEqual([]);
  });

  it("keys an event by bib and checkpoint so late data is still detected", () => {
    expect(eventKey({ bib: "123", checkpointId: "sumiyoshi" })).toBe("123:sumiyoshi");
  });
});
