import { beforeAll, describe, expect, it } from "vitest";
import { getRaceConfig } from "@/config/races";
import { lookupAthletes, searchAthletes } from "@/lib/api/athletes";
import {
  AthleteDetailSchema,
  AthletesResponseSchema,
  EventsResponseSchema,
  LeaderboardSchema,
  MapResponseSchema,
  RaceStateSchema,
  RankingPageSchema,
} from "@/lib/api/contract";
import { buildEventsResponse } from "@/lib/api/events";
import { bibsFromEventsHref } from "@/lib/api/eventsLink";
import { buildLeaderboard } from "@/lib/api/leaderboard";
import { buildMapResponse } from "@/lib/api/map";
import { buildRankingPage } from "@/lib/api/rankings";
import { toAthleteDetail, toRaceState } from "@/lib/api/serialize";
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

/**
 * The wire contract is a set of strict schemas. Every body a route can send
 * is parsed against its schema here, so a field added to an internal type can
 * never reach a client unless the contract says so, and a field the contract
 * promises can never be left out.
 */
describe("wire contract", () => {
  it("race state matches its schema exactly", () => {
    expect(() => RaceStateSchema.parse(toRaceState(snapshot))).not.toThrow();
  });

  it("athlete detail matches its schema exactly, for a finisher and for someone racing", () => {
    const racing = [...snapshot.athletes.values()].find((c) => c.status === "racing");
    const finished = [...snapshot.athletes.values()].find((c) => c.status === "finished");
    for (const computed of [racing, finished]) {
      expect(computed).toBeDefined();
      expect(() =>
        AthleteDetailSchema.parse(toAthleteDetail(snapshot, computed as never)),
      ).not.toThrow();
    }
  });

  it("athlete search and lookup match the list schema", () => {
    expect(() => AthletesResponseSchema.parse(searchAthletes(snapshot, "佐和田"))).not.toThrow();
    const bibs = snapshot.byDivision.A.slice(0, 3) as string[];
    const found = AthletesResponseSchema.parse(lookupAthletes(snapshot, [...bibs, "nope"]));
    expect(found.count).toBe(3);
    expect(found.missing).toEqual(["nope"]);
    // self names the request that produced this body, unknown bibs included.
    expect(found._links.self.href).toBe(
      `/api/athletes?bibs=${encodeURIComponent([...bibs, "nope"].join(","))}`,
    );
  });

  it("leaderboard, ranking page and map match their schemas exactly", () => {
    expect(() => LeaderboardSchema.parse(buildLeaderboard(snapshot, "A", 50))).not.toThrow();
    const page = buildRankingPage(snapshot, {
      division: "A",
      discipline: "swim",
      ageGroupId: null,
      page: 2,
      perPage: 50,
      targetBib: null,
    });
    expect(() => RankingPageSchema.parse(page)).not.toThrow();
    expect(() => MapResponseSchema.parse(buildMapResponse(snapshot, "A", null, []))).not.toThrow();
  });
});

describe("checkpoint events", () => {
  it("lists every checkpoint the bookmarked athletes have passed, newest first", () => {
    const bib = [...snapshot.athletes.values()].find((c) => c.splits.length >= 3)?.athlete
      .bib as string;
    const body = EventsResponseSchema.parse(buildEventsResponse(snapshot, [bib]));
    const own = body.events.filter((event) => event.bib === bib);
    // Not just the latest one: a checkpoint the timing site publishes late is
    // an earlier point on the course, and it has to reach the reader too.
    expect(own.length).toBe(snapshot.athletes.get(bib)?.splits.length);
    for (let i = 1; i < body.events.length; i += 1) {
      expect((body.events[i - 1] as { passedAt: number }).passedAt).toBeGreaterThanOrEqual(
        (body.events[i] as { passedAt: number }).passedAt,
      );
    }
    expect(own[0]?.key).toBe(`${bib}:${own[0]?.checkpointId}`);
    expect(own[0]?._links.self.href).toBe(`/api/athletes/${bib}`);
    expect(body._links.self.href).toBe(`/api/events?bibs=${encodeURIComponent(bib)}`);
  });

  it("says which athletes it answers for, in a form a client can read back", () => {
    const bibs = [...snapshot.athletes.values()].slice(0, 2).map((c) => c.athlete.bib);
    const body = EventsResponseSchema.parse(buildEventsResponse(snapshot, bibs));
    // The client decides whose history it has already caught up on from this
    // link, so the response has to name them and the parser has to agree.
    expect(bibsFromEventsHref(body._links.self.href)).toEqual(bibs);
  });

  it("answers for nobody when no athlete was asked for", () => {
    const body = buildEventsResponse(snapshot, []);
    expect(bibsFromEventsHref(body._links.self.href)).toEqual([]);
  });

  it("is advertised from the race state", () => {
    expect(toRaceState(snapshot)._links.events?.href).toBe("/api/events");
  });
});

describe("hypermedia links", () => {
  it("lets a client walk from a ranking row or a map dot to the athlete", () => {
    const page = buildRankingPage(snapshot, {
      division: "A",
      discipline: "swim",
      ageGroupId: null,
      page: 1,
      perPage: 5,
      targetBib: null,
    });
    const row = page.rows[0];
    expect(row?._links.self.href).toBe(`/api/athletes/${row?.bib}`);
    expect(row?._links.page?.href).toBe(`/athletes/${row?.bib}`);

    const map = buildMapResponse(snapshot, "A", null, []);
    const dot = map.entries[0];
    expect(dot?._links.self.href).toBe(`/api/athletes/${dot?.bib}`);
  });

  it("pages a ranking table through links in the body as well as the header", () => {
    const page = buildRankingPage(snapshot, {
      division: "A",
      discipline: "swim",
      ageGroupId: null,
      page: 2,
      perPage: 50,
      targetBib: null,
    });
    const base = "/api/divisions/A/rankings?discipline=swim";
    expect(page._links.self.href).toBe(`${base}&page=2`);
    expect(page._links.first?.href).toBe(`${base}&page=1`);
    expect(page._links.prev?.href).toBe(`${base}&page=1`);
    expect(page._links.next?.href).toBe(`${base}&page=3`);
    expect(page._links.last?.href).toBe(`${base}&page=${Math.ceil(page.total / 50)}`);
    expect(page._links.leaderboard?.href).toBe("/api/leaderboard?div=A");
  });

  it("links the leaderboard and the map to each other and to the rankings", () => {
    const board = buildLeaderboard(snapshot, "B", 50);
    expect(board._links.self.href).toBe("/api/leaderboard?div=B&page=1");
    expect(board._links.rankings?.href).toBe("/api/divisions/B/rankings");
    expect(board._links.map?.href).toBe("/api/map?div=B");

    const map = buildMapResponse(snapshot, "B", "M40-44", []);
    expect(map._links.self.href).toBe("/api/map?div=B&ageGroup=M40-44");
    expect(map._links.leaderboard?.href).toBe("/api/leaderboard?div=B");
  });
});
