import { describe, expect, it } from "vitest";
import { getRaceConfig } from "@/config/races";
import { buildNameIndex, findPastResults } from "@/lib/history/nameIndex";
import { loadFixtureSnapshot } from "@/lib/testing/fixtures";

const YEARS = [2023, 2024, 2025] as const;

function buildIndex() {
  return buildNameIndex(
    YEARS.map((year) => ({
      year,
      snapshot: loadFixtureSnapshot(year, Date.parse(`${year}-09-30T00:00:00+09:00`)),
      config: getRaceConfig(year),
    })),
  );
}

describe("buildNameIndex", () => {
  const index = buildIndex();

  it("indexes every finisher of every loaded year", () => {
    const total = [...index.values()].flat().length;
    expect(total).toBeGreaterThan(3000);
  });

  it("stores the published total, not a recomputed one", () => {
    const entry = [...index.values()].flat().find((r) => r.totalText !== null);
    expect(entry?.totalText).toMatch(/^\d+:\d{2}:\d{2}$/);
  });

  it("records the division and both ranks", () => {
    const results = [...index.values()].flat();
    const withAge = results.find((r) => r.ageRank !== null);
    expect(["A", "B", "RA", "RB"]).toContain(withAge?.division);
    expect(withAge?.divisionRank.rank).toBeGreaterThan(0);
    expect(withAge?.divisionRank.of).toBeGreaterThan(withAge?.divisionRank.rank ?? 0);
    expect(withAge?.ageRank?.of).toBeGreaterThan(0);
  });

  it("ranks the fastest finisher of a division first", () => {
    const results = [...index.values()].flat().filter((r) => r.year === 2025 && r.division === "A");
    const winner = results.find((r) => r.divisionRank.rank === 1);
    expect(winner).toBeDefined();
    expect(winner?.divisionRank.of).toBe(565);
  });

  it("leaves relay finishers without an age rank", () => {
    const relays = [...index.values()].flat().filter((r) => r.division === "RA" || r.division === "RB");
    expect(relays.length).toBeGreaterThan(0);
    for (const relay of relays) expect(relay.ageRank).toBeNull();
  });
});

describe("findPastResults", () => {
  const index = buildIndex();

  it("returns nothing for a name that never raced", () => {
    expect(findPastResults(index, "存在 しない")).toEqual([]);
  });

  it("returns results newest first", () => {
    const multiYear = [...index.entries()].find(([, results]) => {
      const years = new Set(results.map((r) => r.year));
      return years.size >= 2;
    });
    expect(multiYear).toBeDefined();
    const found = findPastResults(index, multiYear?.[0] as string);
    expect(found.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < found.length; i += 1) {
      expect((found[i - 1] as { year: number }).year).toBeGreaterThanOrEqual(
        (found[i] as { year: number }).year,
      );
    }
  });

  it("matches regardless of which space the name was written with", () => {
    const key = [...index.keys()][0] as string;
    expect(findPastResults(index, key.replace(" ", "　"))).toHaveLength(
      findPastResults(index, key).length,
    );
  });

  it("returns every athlete sharing a name rather than picking one", () => {
    const shared = [...index.entries()].find(([, results]) => {
      const perYear = new Map<number, number>();
      for (const r of results) perYear.set(r.year, (perYear.get(r.year) ?? 0) + 1);
      return [...perYear.values()].some((count) => count > 1);
    });
    if (!shared) return;
    const results = findPastResults(index, shared[0]);
    const years = results.map((r) => r.year);
    expect(new Set(years).size).toBeLessThan(years.length);
  });
});
