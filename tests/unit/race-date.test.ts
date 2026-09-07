import { describe, expect, it } from "vitest";
import { formatMonthDay, formatRaceDate } from "@/lib/format";

describe("race date formatting", () => {
  it("spells the whole date in Japanese", () => {
    expect(formatRaceDate("2026-09-06")).toBe("2026年9月6日");
  });

  it("spells the month and day alone for a card that already carries the year", () => {
    expect(formatMonthDay("2026-09-06")).toBe("9月6日");
    expect(formatMonthDay("2027-10-12")).toBe("10月12日");
  });

  it("hands back input it cannot read", () => {
    expect(formatMonthDay("someday")).toBe("someday");
  });
});
