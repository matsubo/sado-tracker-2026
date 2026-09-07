import { describe, expect, it } from "vitest";
import {
  DEFAULT_SITE_URL,
  EDITION_YEAR,
  SITE_NAME,
  STORAGE_PREFIX,
  storageKey,
} from "@/config/site";
import { pageTitle, SITE_NAME as TITLE_SITE_NAME } from "@/lib/pageTitle";
import { raceYear } from "@/lib/runtime/year";

/**
 * Everything that names the edition derives from one number, so next year's
 * tracker is a one-line change rather than a hunt through the tree.
 */
describe("site identity", () => {
  it("names the site after the edition year", () => {
    expect(SITE_NAME).toBe(`佐渡トラッカー ${EDITION_YEAR}`);
    expect(TITLE_SITE_NAME).toBe(SITE_NAME);
    expect(pageTitle("ブックマーク")).toBe(`ブックマーク | 佐渡トラッカー ${EDITION_YEAR}`);
  });

  it("scopes browser storage to the edition so a new race starts clean", () => {
    expect(STORAGE_PREFIX).toBe(`sado${EDITION_YEAR}`);
    expect(storageKey("bookmarks")).toBe(`sado${EDITION_YEAR}.bookmarks`);
  });

  it("serves the edition year unless the environment says otherwise", () => {
    expect(raceYear({})).toBe(EDITION_YEAR);
    expect(raceYear({ RACE_YEAR: "2025" })).toBe(2025);
  });

  it("points the canonical origin at the edition's domain", () => {
    expect(DEFAULT_SITE_URL).toBe(`https://sado-tracker-${EDITION_YEAR}.teraren.com`);
  });
});
