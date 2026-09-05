import { describe, expect, it } from "vitest";
import { matchesAthlete, matchScore, NO_MATCH } from "@/lib/api/athleteMatch";

const BIB = "1043";
const NAME = "古謝 孝明";

describe("matchesAthlete", () => {
  it("finds a family name on its own", () => {
    expect(matchesAthlete(BIB, NAME, "古謝")).toBe(true);
  });

  it("finds a given name on its own", () => {
    expect(matchesAthlete(BIB, NAME, "孝明")).toBe(true);
  });

  it("finds a fragment from the middle of a name", () => {
    expect(matchesAthlete(BIB, NAME, "謝")).toBe(true);
  });

  it("finds a full name typed without the separator", () => {
    expect(matchesAthlete(BIB, NAME, "古謝孝明")).toBe(true);
  });

  it("accepts a full-width space where the name uses a half-width one", () => {
    expect(matchesAthlete(BIB, NAME, "古謝　孝明")).toBe(true);
  });

  it("finds part of a bib", () => {
    expect(matchesAthlete(BIB, NAME, "104")).toBe(true);
    expect(matchesAthlete(BIB, NAME, "43")).toBe(true);
  });

  it("rejects text that appears in neither", () => {
    expect(matchesAthlete(BIB, NAME, "山田")).toBe(false);
    expect(matchesAthlete(BIB, NAME, "9999")).toBe(false);
  });

  it("ignores surrounding whitespace", () => {
    expect(matchesAthlete(BIB, NAME, "  古謝  ")).toBe(true);
  });

  it("treats empty text as matching everyone, so an empty box filters nothing", () => {
    expect(matchesAthlete(BIB, NAME, "")).toBe(true);
    expect(matchesAthlete(BIB, NAME, "   ")).toBe(true);
  });
});

describe("matchScore", () => {
  it("puts an exact bib first", () => {
    expect(matchScore("1043", NAME, "1043")).toBeLessThan(matchScore("1043", NAME, "104"));
  });

  it("puts a name that starts with the text above one that merely contains it", () => {
    const startsWith = matchScore("1", "古謝 孝明", "古謝");
    const contains = matchScore("2", "田中 古謝子", "古謝");
    expect(startsWith).toBeLessThan(contains);
  });

  it("returns NO_MATCH for text found in neither the bib nor the name", () => {
    expect(matchScore(BIB, NAME, "山田")).toBe(NO_MATCH);
  });

  it("matches a bib fragment that is not a prefix", () => {
    expect(matchScore("1043", NAME, "043")).not.toBe(NO_MATCH);
  });
});
