import { describe, expect, it } from "vitest";
import { getRaceConfig } from "@/config/races";
import { formatDuration } from "@/lib/format/duration";
import { loadFixtureSnapshot } from "@/lib/testing/fixtures";

/**
 * The source publishes 総合記録 for every finisher. Our own FINISH minus
 * START must reproduce it exactly. This is the reference that fixes the
 * rounding rule: the timing system truncates, so formatDuration truncates.
 */
describe("total time agrees with the published 総合記録", () => {
  for (const year of [2023, 2024, 2025]) {
    it(`matches every finisher in ${year}`, () => {
      const snapshot = loadFixtureSnapshot(year);
      const mismatches: string[] = [];
      let checked = 0;

      for (const athlete of snapshot.athletes) {
        const finish = athlete.passes.finish;
        if (!athlete.officialTotal || finish === undefined) continue;
        checked += 1;
        const ours = formatDuration(finish - athlete.startAt);
        if (ours !== athlete.officialTotal) {
          mismatches.push(`${athlete.bib}: ours ${ours}, published ${athlete.officialTotal}`);
        }
      }

      expect(checked).toBeGreaterThan(1000);
      expect(mismatches).toEqual([]);
    });
  }
});

describe("the parser survives every real export", () => {
  for (const year of [2023, 2024, 2025]) {
    it(`parses ${year} into the expected divisions`, () => {
      const snapshot = loadFixtureSnapshot(year);
      const config = getRaceConfig(year);
      expect(snapshot.athletes.length).toBeGreaterThan(1700);

      for (const athlete of snapshot.athletes) {
        expect(["A", "B", "RA", "RB"]).toContain(athlete.division);
        expect(athlete.bib).not.toBe("");
        expect(Number.isFinite(athlete.startAt)).toBe(true);
        if (athlete.division === "RA" || athlete.division === "RB") continue;
        // Every non-relay athlete either has an age group or is one of the
        // handful of entries the organizer left blank.
        expect(athlete.ageGroup === null || athlete.ageGroup.id.length >= 4).toBe(true);
      }

      expect(config.year).toBe(year);
    });
  }

  it("gives every athlete a unique bib", () => {
    for (const year of [2023, 2024, 2025]) {
      const snapshot = loadFixtureSnapshot(year);
      const bibs = new Set(snapshot.athletes.map((a) => a.bib));
      expect(bibs.size).toBe(snapshot.athletes.length);
    }
  });
});
