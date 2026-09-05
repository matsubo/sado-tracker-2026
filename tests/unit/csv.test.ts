import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getRaceConfig } from "@/config/races";
import { decodeCp932 } from "@/lib/csv/decode";
import { toSnapshot } from "@/lib/csv/normalize";
import { parseCsv } from "@/lib/csv/parse";

const config = getRaceConfig(2026);
const FETCHED_AT = Date.parse("2026-09-06T12:00:00+09:00");

function loadFixture() {
  const buffer = readFileSync("tests/fixtures/sample-2026.csv");
  const text = decodeCp932(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  );
  return toSnapshot(parseCsv(text), config, FETCHED_AT);
}

const jst = (iso: string) => Date.parse(iso);

describe("decodeCp932", () => {
  it("recovers the Japanese headers and names", () => {
    const buffer = readFileSync("tests/fixtures/sample-2026.csv");
    const text = decodeCp932(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    );
    expect(text).toContain("年齢区分");
    expect(text).toContain("佐和田　蓮");
    expect(text).toContain("ﾗﾝS（本部）");
  });
});

describe("parseCsv", () => {
  it("keeps quoted fields together and strips the quotes", () => {
    const rows = parseCsv('"a,b",c\r\n1,2\r\n');
    expect(rows).toEqual([
      ["a,b", "c"],
      ["1", "2"],
    ]);
  });

  it("ignores a trailing newline", () => {
    expect(parseCsv("a,b\r\n")).toEqual([["a", "b"]]);
  });
});

describe("toSnapshot", () => {
  it("drops reserve and blank-division rows", () => {
    const snapshot = loadFixture();
    const bibs = snapshot.athletes.map((a) => a.bib);
    expect(bibs).not.toContain("9001");
    expect(bibs).not.toContain("9002");
    expect(snapshot.athletes).toHaveLength(10);
  });

  it("merges the millisecond column into the timestamp", () => {
    const a = loadFixture().athletes.find((x) => x.bib === "1001");
    expect(a?.passes.swimF).toBe(jst("2026-09-06T07:20:30+09:00") + 450);
    expect(a?.passes.finish).toBe(jst("2026-09-06T19:58:30+09:00") + 110);
  });

  it("reads timestamps as Asia/Tokyo", () => {
    const a = loadFixture().athletes.find((x) => x.bib === "1002");
    expect(a?.startAt).toBe(jst("2026-09-06T06:00:00+09:00"));
  });

  it("normalizes the full-width space in names", () => {
    const a = loadFixture().athletes.find((x) => x.bib === "1001");
    expect(a?.name).toBe("佐和田　蓮");
    expect(a?.nameKey).toBe("佐和田 蓮");
  });

  it("maps divisions and age groups", () => {
    const a = loadFixture().athletes.find((x) => x.bib === "1002");
    expect(a?.division).toBe("A");
    expect(a?.ageGroup?.id).toBe("F45-49");
    expect(a?.sex).toBe("F");
  });

  it("leaves relay entries without a sex or age group", () => {
    const a = loadFixture().athletes.find((x) => x.bib === "5001");
    expect(a?.division).toBe("RB");
    expect(a?.sex).toBeNull();
    expect(a?.ageGroup).toBeNull();
  });

  it("falls back to the configured wave start when START is empty", () => {
    const a = loadFixture().athletes.find((x) => x.bib === "1006");
    expect(a?.startAt).toBe(jst("2026-09-06T06:00:00+09:00"));
    expect(a?.startInferred).toBe(true);
  });

  it("marks a real START as not inferred", () => {
    const a = loadFixture().athletes.find((x) => x.bib === "1001");
    expect(a?.startInferred).toBe(false);
  });

  it("keeps pre-race timing points out of the race checkpoints", () => {
    const a = loadFixture().athletes.find((x) => x.bib === "1001");
    expect(a?.passes.reception).toBeUndefined();
    expect(a?.passes.waterEntry).toBeUndefined();
    expect(a?.preRace.waterEntry).toBe(jst("2026-09-06T05:40:00+09:00") + 820);
    expect(a?.preRace.reception).toBe(jst("2026-09-05T11:54:07+09:00") + 38);
  });

  it("records the water entry that distinguishes a swim abandon from a no-show", () => {
    const racing = loadFixture().athletes.find((x) => x.bib === "1003");
    const absent = loadFixture().athletes.find((x) => x.bib === "1004");
    expect(racing?.preRace.waterEntry).toBeGreaterThan(0);
    expect(absent?.preRace.waterEntry).toBeUndefined();
  });

  it("carries the official total and the remark through unchanged", () => {
    const finisher = loadFixture().athletes.find((x) => x.bib === "1001");
    const dnf = loadFixture().athletes.find((x) => x.bib === "1005");
    expect(finisher?.officialTotal).toBe("13:58:30");
    expect(dnf?.remark).toBe("DNF/本部(20:24)");
    expect(finisher?.remark).toBe("");
  });

  it("omits checkpoints the athlete has not reached", () => {
    const a = loadFixture().athletes.find((x) => x.bib === "1002");
    expect(a?.passes.sumiyoshi).toBeDefined();
    expect(a?.passes.runS).toBeUndefined();
    expect(a?.passes.finish).toBeUndefined();
  });

  it("keeps the snapshot metadata", () => {
    const snapshot = loadFixture();
    expect(snapshot.year).toBe(2026);
    expect(snapshot.fetchedAt).toBe(FETCHED_AT);
  });

  it("rejects a duplicate bib rather than silently keeping one row", () => {
    const buffer = readFileSync("tests/fixtures/sample-2026.csv");
    const text = decodeCp932(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    );
    const rows = parseCsv(text);
    const duplicated = [...rows, rows[1] as string[]];
    expect(() => toSnapshot(duplicated, config, FETCHED_AT)).toThrow(/duplicate bib/i);
  });

  it("ignores an unknown header instead of throwing", () => {
    const rows = parseCsv(
      '"No.","名前","性別","部門","年齢区分","START",謎の列\r\n1,あ　い,男,Aタイプ,40-44歳男子,2026/09/06 06:00:00,x\r\n',
    );
    const snapshot = toSnapshot(rows, config, FETCHED_AT);
    expect(snapshot.athletes).toHaveLength(1);
    expect(snapshot.athletes[0]?.bib).toBe("1");
  });

  it("drops a row with no bib", () => {
    const rows = parseCsv(
      '"No.","名前","性別","部門","年齢区分","START"\r\n,あ　い,男,Aタイプ,40-44歳男子,2026/09/06 06:00:00\r\n',
    );
    expect(toSnapshot(rows, config, FETCHED_AT).athletes).toHaveLength(0);
  });
});
