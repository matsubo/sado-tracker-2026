import { describe, expect, it } from "vitest";
import { getRaceConfig, normalizeAgeGroup, normalizeDivision, normalizeName } from "@/config/races";

describe("normalizeDivision", () => {
  const c2026 = getRaceConfig(2026);
  const c2023 = getRaceConfig(2023);
  const c2022 = getRaceConfig(2022);

  it("maps the 2026 labels", () => {
    expect(normalizeDivision("Aタイプ", c2026)).toBe("A");
    expect(normalizeDivision("Bタイプ", c2026)).toBe("B");
    expect(normalizeDivision("RAタイプ", c2026)).toBe("RA");
    expect(normalizeDivision("RBタイプ", c2026)).toBe("RB");
  });

  it("maps full-width labels used in 2023", () => {
    expect(normalizeDivision("Ａタイプ", c2023)).toBe("A");
    expect(normalizeDivision("Ｂタイプ", c2023)).toBe("B");
    // The single relay class of 2023 raced the middle distance.
    expect(normalizeDivision("Ｒタイプ", c2023)).toBe("RB");
  });

  it("maps the ASCII labels used in 2022", () => {
    expect(normalizeDivision("ATYPE", c2022)).toBe("A");
    expect(normalizeDivision("BTYPE", c2022)).toBe("B");
    expect(normalizeDivision("RTYPE", c2022)).toBe("RB");
  });

  it("files the championship under the middle distance it actually races", () => {
    // Championship finishers median 5.4 hours; A type medians 14.2. Filing
    // them under A would divide their times by long-course distances.
    expect(normalizeDivision("チャンピオンシップ", c2023)).toBe("B");
    expect(normalizeDivision("CHAMPIONSHIP", c2022)).toBe("B");
  });

  it("keeps the elite long race under A", () => {
    expect(normalizeDivision("ATYPE ELITE", c2022)).toBe("A");
  });

  it("rejects reserve and empty divisions", () => {
    expect(normalizeDivision("予備", c2026)).toBeNull();
    expect(normalizeDivision("", c2026)).toBeNull();
    expect(normalizeDivision("   ", c2026)).toBeNull();
  });
});

describe("normalizeAgeGroup", () => {
  it("maps the 2025 style labels to the ai-tri notation", () => {
    expect(normalizeAgeGroup("40-44男子")?.id).toBe("M40-44");
    expect(normalizeAgeGroup("45-49女子")?.id).toBe("F45-49");
    expect(normalizeAgeGroup("30-34男子")?.id).toBe("M30-34");
  });

  it("maps the 2026 style labels that include 歳", () => {
    expect(normalizeAgeGroup("40-44歳男子")?.id).toBe("M40-44");
    expect(normalizeAgeGroup("80-84歳女子")?.id).toBe("F80-84");
    expect(normalizeAgeGroup("35-39歳男子")?.id).toBe("M35-39");
  });

  it("maps the 2022 and 2023 style labels", () => {
    expect(normalizeAgeGroup("M40-44")?.id).toBe("M40-44");
    expect(normalizeAgeGroup("F18-24")?.id).toBe("F18-24");
  });

  it("gives the youngest bracket a zero lower bound", () => {
    expect(normalizeAgeGroup("24歳以下男子")?.id).toBe("M0-24");
    expect(normalizeAgeGroup("24歳以下女子")?.id).toBe("F0-24");
  });

  it("keeps the sex, bounds and a full label for display and sorting", () => {
    const g = normalizeAgeGroup("45-49女子");
    expect(g).toEqual({ id: "F45-49", sex: "F", min: 45, max: 49, label: "女子45-49" });
    const youngest = normalizeAgeGroup("24歳以下男子");
    expect(youngest).toEqual({ id: "M0-24", sex: "M", min: 0, max: 24, label: "男子24歳以下" });
  });

  it("returns null for empty or unknown labels", () => {
    expect(normalizeAgeGroup("")).toBeNull();
    expect(normalizeAgeGroup("チーム")).toBeNull();
  });
});

describe("normalizeName", () => {
  it("collapses the full-width space used by the source", () => {
    expect(normalizeName("岩渕　努")).toBe("岩渕 努");
  });

  it("trims and collapses runs of spaces", () => {
    expect(normalizeName("  松倉   友樹 ")).toBe("松倉 友樹");
  });
});

describe("getRaceConfig", () => {
  it("knows the shortened 2025 B swim", () => {
    expect(getRaceConfig(2025).divisions.B.swimKm).toBe(1.35);
    expect(getRaceConfig(2025).divisions.B.swimTimesComparable).toBe(false);
  });

  it("uses the standard 2 km B swim in the years that swam it", () => {
    expect(getRaceConfig(2024).divisions.B.swimKm).toBe(2.0);
    expect(getRaceConfig(2023).divisions.B.swimKm).toBe(2.0);
  });

  it("knows the 2026 swim was halved on the morning for wind and tide", () => {
    for (const division of ["A", "RA"] as const) {
      const course = getRaceConfig(2026).divisions[division];
      expect(course.swimKm).toBe(2.0);
      expect(course.waveStart).toBe("06:30");
      expect(course.swimTimesComparable).toBe(false);
    }
    for (const division of ["B", "RB"] as const) {
      const course = getRaceConfig(2026).divisions[division];
      expect(course.swimKm).toBe(1.0);
      expect(course.waveStart).toBe("08:00");
      expect(course.swimTimesComparable).toBe(false);
    }
  });

  it("puts the 2026 swim lap at the turn of the two 1,000 m laps", () => {
    const lap = getRaceConfig(2026).divisions.A.checkpoints.find((c) => c.id === "swimL");
    expect(lap?.km).toBe(1.0);
    const finish = getRaceConfig(2026).divisions.A.checkpoints.find((c) => c.id === "swimF");
    expect(finish?.km).toBe(2.0);
  });

  it("keeps the 2026 bike and run at full distance", () => {
    const a = getRaceConfig(2026).divisions.A;
    expect(a.bikeKm).toBe(190);
    expect(a.runKm).toBe(42.2);
    const b = getRaceConfig(2026).divisions.B;
    expect(b.bikeKm).toBe(108);
    expect(b.runKm).toBe(21.1);
  });

  it("keeps the A bike and run constant across years", () => {
    for (const year of [2023, 2024, 2025, 2026]) {
      const a = getRaceConfig(year).divisions.A;
      expect(a.bikeKm).toBe(190);
      expect(a.runKm).toBe(42.2);
    }
    for (const year of [2023, 2024, 2025]) {
      expect(getRaceConfig(year).divisions.A.swimKm).toBe(4.0);
    }
  });

  it("starts every earlier year at the usual times", () => {
    for (const year of [2023, 2024, 2025]) {
      expect(getRaceConfig(year).divisions.A.waveStart).toBe("06:00");
      expect(getRaceConfig(year).divisions.B.waveStart).toBe("07:30");
    }
  });

  it("orders checkpoints from the start to the finish", () => {
    const course = getRaceConfig(2026).divisions.A;
    const ids = course.checkpoints.map((c) => c.id);
    expect(ids[0]).toBe("start");
    expect(ids.at(-1)).toBe("finish");
    expect(ids).toContain("sumiyoshi");
  });

  it("gives the B course no swim lap and a shorter run", () => {
    const b = getRaceConfig(2026).divisions.B;
    const ids = b.checkpoints.map((c) => c.id);
    expect(ids).not.toContain("swimL");
    expect(ids).not.toContain("run24");
    expect(b.runKm).toBe(21.1);
  });

  it("excludes 2022 from prediction training", () => {
    expect(getRaceConfig(2022).usableForPrediction).toBe(false);
    expect(getRaceConfig(2025).usableForPrediction).toBe(true);
  });

  it("throws for an unknown year", () => {
    expect(() => getRaceConfig(1999)).toThrow(/1999/);
  });
});
