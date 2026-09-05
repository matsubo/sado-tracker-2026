import { beforeAll, describe, expect, it } from "vitest";
import { getRaceConfig } from "@/config/races";
import { buildLeaderboard } from "@/lib/api/leaderboard";
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

describe("ranking pagination", () => {
  it("opens on the target athlete's page when no page is requested", () => {
    const first = buildRankingPage(snapshot, {
      division: "A",
      discipline: "swim",
      ageGroupId: null,
      page: 1,
      perPage: 50,
      targetBib: null,
    });
    const deepTarget = first.rows[0]?.bib as string;
    const all = buildRankingPage(snapshot, {
      division: "A",
      discipline: "swim",
      ageGroupId: null,
      page: null,
      perPage: 50,
      targetBib: deepTarget,
    });
    expect(all.rows.some((row) => row.isTarget)).toBe(true);
  });

  it("respects an explicit page rather than snapping back to the target", () => {
    const first = buildRankingPage(snapshot, {
      division: "A",
      discipline: "swim",
      ageGroupId: null,
      page: 1,
      perPage: 50,
      targetBib: null,
    });
    const target = first.rows[10]?.bib as string;

    // Page 3 must stay page 3 even though the target sits on page 1: otherwise
    // a reader who pages forward is thrown back every time.
    const third = buildRankingPage(snapshot, {
      division: "A",
      discipline: "swim",
      ageGroupId: null,
      page: 3,
      perPage: 50,
      targetBib: target,
    });
    expect(third.page).toBe(3);
    expect(third.rows.some((row) => row.isTarget)).toBe(false);
    expect(third.rows[0]?.rank).toBeGreaterThan(100);
  });

  it("still centres on a target deep in the table", () => {
    const rows = buildRankingPage(snapshot, {
      division: "A",
      discipline: "swim",
      ageGroupId: null,
      page: 5,
      perPage: 50,
      targetBib: null,
    });
    const deepBib = rows.rows[5]?.bib as string;
    const centred = buildRankingPage(snapshot, {
      division: "A",
      discipline: "swim",
      ageGroupId: null,
      page: null,
      perPage: 50,
      targetBib: deepBib,
    });
    expect(centred.page).toBe(5);
    expect(centred.rows.some((row) => row.isTarget)).toBe(true);
  });
});

describe("leaderboard", () => {
  it("lists the front of a division in field order", () => {
    const board = buildLeaderboard(snapshot, "A", 20);
    expect(board.division).toBe("A");
    expect(board.leaders).toHaveLength(20);
    expect(board.leaders[0]?.place).toBe(1);
    expect(board.leaders.at(-1)?.place).toBe(20);
    expect(board.total).toBeGreaterThan(700);
  });

  it("pages through the whole field, numbering places across pages", () => {
    const first = buildLeaderboard(snapshot, "A", 100, 1);
    const second = buildLeaderboard(snapshot, "A", 100, 2);

    expect(first.leaders).toHaveLength(100);
    expect(first.leaders[0]?.place).toBe(1);
    expect(second.leaders[0]?.place).toBe(101);
    expect(second.page).toBe(2);
    expect(second.total).toBe(first.total);

    // No athlete appears on both pages.
    const firstBibs = new Set(first.leaders.map((row) => row.athlete.bib));
    expect(second.leaders.some((row) => firstBibs.has(row.athlete.bib))).toBe(false);
  });

  it("returns an empty page past the end rather than failing", () => {
    const board = buildLeaderboard(snapshot, "A", 100, 99);
    expect(board.leaders).toEqual([]);
    expect(board.total).toBeGreaterThan(0);
  });

  it("puts athletes further along the course ahead of faster ones behind them", () => {
    const board = buildLeaderboard(snapshot, "A", 20);
    const kms = board.leaders.map((row) => row.athlete.position.estKm);
    expect(kms[0]).toBeGreaterThan(0);
    // Leaders are on the same or a later leg than those behind them.
    const legOrder = { swim: 0, bike: 1, run: 2 } as const;
    for (let i = 1; i < board.leaders.length; i += 1) {
      const ahead = legOrder[board.leaders[i - 1]?.athlete.position.discipline as "swim"];
      const behind = legOrder[board.leaders[i]?.athlete.position.discipline as "swim"];
      expect(ahead).toBeGreaterThanOrEqual(behind);
    }
  });

  it("counts everyone entered, not only those on the board", () => {
    const board = buildLeaderboard(snapshot, "A", 5);
    expect(board.leaders).toHaveLength(5);
    expect(board.entrants).toBeGreaterThan(900);
    expect(board.racing).toBeLessThanOrEqual(board.entrants);
  });

  it("returns an empty board rather than failing for an empty division", () => {
    const board = buildLeaderboard(snapshot, "RB", 20);
    expect(board.division).toBe("RB");
    expect(Array.isArray(board.leaders)).toBe(true);
  });
});

describe("the difference column", () => {
  it("measures from the leader when no athlete is chosen", () => {
    const page = buildRankingPage(snapshot, {
      division: "A",
      discipline: "swim",
      ageGroupId: null,
      page: 1,
      perPage: 50,
      targetBib: null,
    });
    expect(page.diffBasis?.kind).toBe("leader");
    expect(page.rows[0]?.diffMs).toBe(0);
    // Everyone behind the leader is slower, so the differences are positive.
    for (const row of page.rows.slice(1)) {
      expect(row.diffMs).toBeGreaterThan(0);
    }
  });

  it("measures from the chosen athlete when one is given", () => {
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
      page: null,
      perPage: 50,
      targetBib: target,
    });
    expect(focused.diffBasis?.kind).toBe("athlete");
    expect(focused.rows.find((row) => row.isTarget)?.diffMs).toBe(0);
    expect(focused.rows.some((row) => (row.diffMs as number) < 0)).toBe(true);
  });

  it("names the athlete the differences are measured from", () => {
    const first = buildRankingPage(snapshot, {
      division: "A",
      discipline: "swim",
      ageGroupId: null,
      page: 1,
      perPage: 50,
      targetBib: null,
    });
    expect(first.diffBasis?.name).toBe(first.rows[0]?.name);
  });

  it("reports no basis when nobody has been measured", () => {
    const page = buildRankingPage(snapshot, {
      division: "A",
      discipline: "total",
      ageGroupId: null,
      page: 1,
      perPage: 50,
      targetBib: null,
    });
    expect(page.total).toBe(0);
    expect(page.diffBasis).toBeNull();
  });
});

describe("past results", () => {
  it("never reports a physically impossible pace", () => {
    // A championship entry filed under the long course produced 71 km/h on
    // the bike, because middle-distance times were divided by 190 km.
    let checked = 0;
    for (const computed of snapshot.athletes.values()) {
      for (const result of computed.pastResults) {
        for (const leg of result.disciplines) {
          const hours = leg.timeMs / 3_600_000;
          if (hours <= 0) continue;
          const kmh = leg.km / hours;
          checked += 1;
          if (leg.discipline === "bike") expect(kmh).toBeLessThan(50);
          if (leg.discipline === "run") expect(kmh).toBeLessThan(22);
          if (leg.discipline === "swim") expect(kmh).toBeLessThan(8);
        }
      }
    }
    expect(checked).toBeGreaterThan(50);
  });

  it("carries the distance raced that year alongside each time", () => {
    const withHistory = [...snapshot.athletes.values()].find(
      (computed) => computed.pastResults.length > 0,
    );
    const legs = withHistory?.pastResults[0]?.disciplines ?? [];
    expect(legs.length).toBeGreaterThan(0);
    for (const leg of legs) expect(leg.km).toBeGreaterThan(0);
  });
});

describe("course neighbours", () => {
  it("shows age-group rivals for an athlete who has an age group", () => {
    const withAge = [...snapshot.athletes.values()].find(
      (c) => c.athlete.ageGroup !== null && c.fieldOrder !== Number.MAX_SAFE_INTEGER,
    );
    const detail = toAthleteDetail(snapshot, withAge as never);
    expect(detail.neighbours.length).toBeGreaterThan(1);
    for (const entry of detail.neighbours) {
      expect(entry.ageGroupId).toBe(detail.ageGroupId);
    }
  });

  it("falls back to the division for a relay, which has no age group", () => {
    // A relay grouped by age group could only ever see itself.
    const relay = [...snapshot.athletes.values()].find(
      (c) =>
        (c.athlete.division === "RA" || c.athlete.division === "RB") &&
        c.fieldOrder !== Number.MAX_SAFE_INTEGER,
    );
    if (!relay) return;
    const detail = toAthleteDetail(snapshot, relay);
    expect(detail.neighbours.length).toBeGreaterThan(1);
    expect(detail.neighbours.some((entry) => entry.isSelf)).toBe(true);
  });
});

describe("displayed names", () => {
  it("never carries the source's ideographic space", () => {
    let checked = 0;
    for (const computed of snapshot.athletes.values()) {
      expect(computed.athlete.name).not.toContain("　");
      checked += 1;
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it("keeps the external link keyed by the same single-space name", () => {
    expect(aiTriHref("松倉　友樹")).toBe(
      "https://ai-triathlon-result.teraren.com/athletes/%E6%9D%BE%E5%80%89%20%E5%8F%8B%E6%A8%B9",
    );
    expect(aiTriHref("松倉 友樹")).toBe(aiTriHref("松倉　友樹"));
  });
});
