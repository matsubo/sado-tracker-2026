import { describe, expect, it } from "vitest";
import { paceMinPerKm, speedKmh } from "@/lib/compute/pace";
import { median, percentile } from "@/lib/math/stats";

describe("median", () => {
  it("returns the middle value of an odd-length list", () => {
    expect(median([5, 1, 3])).toBe(3);
  });

  it("averages the two middle values of an even-length list", () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("is null for an empty list and leaves the input untouched", () => {
    const values = [3, 1, 2];
    expect(median([])).toBeNull();
    median(values);
    expect(values).toEqual([3, 1, 2]);
  });
});

describe("percentile", () => {
  it("reads the nearest rank off a sorted list", () => {
    const sorted = [10, 20, 30, 40, 50];
    expect(percentile(sorted, 0)).toBe(10);
    expect(percentile(sorted, 0.5)).toBe(30);
    expect(percentile(sorted, 0.75)).toBe(40);
    expect(percentile(sorted, 1)).toBe(50);
  });

  it("is zero for an empty list", () => {
    expect(percentile([], 0.5)).toBe(0);
  });
});

describe("pace and speed", () => {
  it("converts a time over a distance to minutes per kilometre", () => {
    expect(paceMinPerKm(30 * 60_000, 5)).toBe(6);
  });

  it("converts a time over a distance to kilometres per hour", () => {
    expect(speedKmh(60, 2 * 3_600_000)).toBe(30);
  });

  it("refuses a zero or negative time or distance", () => {
    expect(paceMinPerKm(0, 5)).toBeNull();
    expect(paceMinPerKm(1000, 0)).toBeNull();
    expect(speedKmh(0, 1000)).toBeNull();
    expect(speedKmh(10, -1)).toBeNull();
  });
});
