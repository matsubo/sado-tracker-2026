import { describe, expect, it } from "vitest";
import {
  COURSE_SHARES,
  DISCIPLINE_LABELS,
  DISCIPLINES,
  DIVISION_LABELS,
  DIVISIONS,
  isDiscipline,
  isDivision,
} from "@/config/races";

describe("division and discipline constants", () => {
  it("lists the four divisions in display order with their labels", () => {
    expect(DIVISIONS).toEqual(["A", "B", "RA", "RB"]);
    expect(DIVISION_LABELS.A).toBe("Aタイプ");
    expect(DIVISION_LABELS.RA).toBe("RAタイプ（リレー）");
    expect(isDivision("RB")).toBe(true);
    expect(isDivision("C")).toBe(false);
  });

  it("lists the disciplines in race order with their labels", () => {
    expect(DISCIPLINES).toEqual(["swim", "bike", "run"]);
    expect(DISCIPLINE_LABELS).toEqual({ swim: "スイム", bike: "バイク", run: "ラン" });
    expect(isDiscipline("bike")).toBe(true);
    expect(isDiscipline("transition")).toBe(false);
  });

  it("gives each leg a fixed share of a course axis that adds up to the whole", () => {
    expect(COURSE_SHARES.swim + COURSE_SHARES.bike + COURSE_SHARES.run).toBeCloseTo(1);
    expect(COURSE_SHARES.bike).toBeGreaterThan(COURSE_SHARES.run);
  });
});
