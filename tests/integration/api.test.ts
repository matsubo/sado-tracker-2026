import { beforeAll, describe, expect, it } from "vitest";
import { getRaceConfig } from "@/config/races";
import { buildRankingPage } from "@/lib/api/rankings";
import { aiTriHref, toAthleteDetail, toAthleteSummary, toRaceState } from "@/lib/api/serialize";
import type { ComputedSnapshot } from "@/lib/compute/snapshot";
import { computeSnapshot } from "@/lib/compute/snapshot";
import { buildNeighbourModel } from "@/lib/history/model";
import { buildNameIndex, type HistoryYear } from "@/lib/history/nameIndex";
import { loadFixtureSnapshot } from "@/lib/testing/fixtures";

const MID_RACE = Date.parse("2025-09-07T13:00:00+09:00");
let snapshot: ComputedSnapshot;

beforeAll(() => {
  const years: HistoryYear[] = [2023, 2024].map((year) => ({
    year,
    snapshot: loadFixtureSnapshot(year, Date.parse(`${year}-09-30T00:00:00+09:00`)),
    config: getRaceConfig(year),
  }));
  const config = getRaceConfig(2025);
  const raw = loadFixtureSnapshot(2025, MID_RACE);
  const visible = {
    ...raw,
    athletes: raw.athletes.map((a) => ({
      ...a,
      passes: Object.fromEntries(Object.entries(a.passes).filter(([, at]) => at <= MID_RACE)),
    })),
  };
  snapshot = computeSnapshot(
    visible,
    config,
    buildNeighbourModel(years, config),
    buildNameIndex(years),
    MID_RACE,
  );
});

describe("race state", () => {
  it("reports the year, update time and per-division counts", () => {
    const state = toRaceState(snapshot);
    expect(state.year).toBe(2025);
    expect(state.stale).toBe(false);
    expect(state.counts.A.swimF).toBeGreaterThan(700);
    expect(state._links.self.href).toBe("/api/race");
  });

  it("counts everyone entered, not only those currently scored", () => {
    const state = toRaceState(snapshot);
    const total = state.divisions.reduce((sum, d) => sum + d.entrants, 0);
    expect(total).toBe(snapshot.athletes.size);
  });

  it("lists each division with its checkpoints in course order", () => {
    const state = toRaceState(snapshot);
    const a = state.divisions.find((d) => d.id === "A");
    expect(a?.entrants).toBeGreaterThan(900);
    expect(a?.racing).toBeGreaterThan(700);
    expect(a?.racing).toBeLessThanOrEqual(a?.entrants as number);
    expect(a?.checkpoints[0]?.id).toBe("swimL");
    expect(a?.checkpoints.at(-1)?.id).toBe("finish");
    const b = state.divisions.find((d) => d.id === "B");
    expect(b?.checkpoints.map((c) => c.id)).not.toContain("swimL");
  });
});

describe("athlete serialization", () => {
  it("carries HAL links including the external athlete page", () => {
    const computed = snapshot.athletes.get(snapshot.byDivision.A[0] as string);
    const dto = toAthleteSummary(computed as NonNullable<typeof computed>);
    expect(dto._links.self.href).toBe(`/api/athletes/${dto.bib}`);
    expect(dto._links.aiTri?.href).toContain("ai-triathlon-result.teraren.com/athletes/");
  });

  it("builds the external link with an ASCII space, URL encoded", () => {
    expect(aiTriHref("松倉　友樹")).toBe(
      "https://ai-triathlon-result.teraren.com/athletes/%E6%9D%BE%E5%80%89%20%E5%8F%8B%E6%A8%B9",
    );
  });

  it("reports a rank together with the population it was taken against", () => {
    const computed = snapshot.athletes.get(snapshot.byDivision.A[10] as string);
    const dto = toAthleteSummary(computed as NonNullable<typeof computed>);
    const rank = dto.totalRanks.division;
    expect(rank?.rank).toBeLessThanOrEqual(rank?.of as number);
  });

  it("includes splits, rank history and age-group neighbours in the detail", () => {
    const bib = snapshot.byDivision.A[100] as string;
    const detail = toAthleteDetail(snapshot, snapshot.athletes.get(bib) as never);
    expect(detail.splits.length).toBeGreaterThan(0);
    expect(detail.rankHistory.length).toBe(detail.splits.length);
    expect(detail.neighbours.some((n) => n.isSelf)).toBe(true);
    expect(detail.neighbours.length).toBeGreaterThan(1);
  });

  it("rounds displayed speeds instead of leaking float noise", () => {
    const detail = toAthleteDetail(
      snapshot,
      snapshot.athletes.get(snapshot.byDivision.A[5] as string) as never,
    );
    for (const split of detail.splits) {
      if (split.segmentSpeedKmh === null) continue;
      expect(split.segmentSpeedKmh).toBe(Math.round(split.segmentSpeedKmh * 10) / 10);
    }
  });
});

describe("ranking pages", () => {
  it("ranks the swim and reports the population", () => {
    const page = buildRankingPage(snapshot, {
      division: "A",
      discipline: "swim",
      ageGroupId: null,
      page: 1,
      perPage: 50,
      targetBib: null,
    });
    expect(page.total).toBeGreaterThan(700);
    expect(page.rows).toHaveLength(50);
    expect(page.rows[0]?.rank).toBe(1);
    expect(page.rows[0]?.paceText).toMatch(/\/100m$/);
  });

  it("orders rows fastest first", () => {
    const page = buildRankingPage(snapshot, {
      division: "A",
      discipline: "swim",
      ageGroupId: null,
      page: 1,
      perPage: 50,
      targetBib: null,
    });
    for (let i = 1; i < page.rows.length; i += 1) {
      expect((page.rows[i - 1] as { timeMs: number }).timeMs).toBeLessThanOrEqual(
        (page.rows[i] as { timeMs: number }).timeMs,
      );
    }
  });

  it("filters to one age group", () => {
    const all = buildRankingPage(snapshot, {
      division: "A",
      discipline: "swim",
      ageGroupId: null,
      page: 1,
      perPage: 50,
      targetBib: null,
    });
    const group = buildRankingPage(snapshot, {
      division: "A",
      discipline: "swim",
      ageGroupId: "M50-54",
      page: 1,
      perPage: 50,
      targetBib: null,
    });
    expect(group.total).toBeLessThan(all.total);
    expect(group.rows.every((row) => row.ageGroupId === "M50-54")).toBe(true);
  });

  it("makes differences relative to the target athlete and jumps to their page", () => {
    const first = buildRankingPage(snapshot, {
      division: "A",
      discipline: "swim",
      ageGroupId: null,
      page: 1,
      perPage: 50,
      targetBib: null,
    });
    const target = first.rows[20]?.bib as string;
    const focused = buildRankingPage(snapshot, {
      division: "A",
      discipline: "swim",
      ageGroupId: null,
      page: 1,
      perPage: 50,
      targetBib: target,
    });
    const targetRow = focused.rows.find((row) => row.isTarget);
    expect(targetRow?.diffMs).toBe(0);
    expect(focused.rows.some((row) => (row.diffMs as number) < 0)).toBe(true);
  });

  it("explains where a target athlete is when they are not in the table yet", () => {
    const stillRacing = [...snapshot.athletes.values()].find(
      (c) => c.status === "racing" && c.athlete.division === "A" && c.lastCheckpointId !== null,
    );
    const page = buildRankingPage(snapshot, {
      division: "A",
      discipline: "run",
      ageGroupId: null,
      page: 1,
      perPage: 50,
      targetBib: stillRacing?.athlete.bib ?? null,
    });
    expect(page.targetElsewhere?.message).toContain("通過");
  });

  it("returns an empty table rather than failing when nobody has finished", () => {
    const page = buildRankingPage(snapshot, {
      division: "A",
      discipline: "total",
      ageGroupId: null,
      page: 1,
      perPage: 50,
      targetBib: null,
    });
    expect(page.total).toBe(0);
    expect(page.rows).toEqual([]);
  });
});
