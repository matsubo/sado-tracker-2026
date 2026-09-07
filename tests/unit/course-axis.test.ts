import { describe, expect, it } from "vitest";
import {
  buildAxis,
  buildTicks,
  fitLabels,
  kmTicks,
  labelWidth,
  scaleKm,
} from "@/lib/chart/courseAxis";

const CHECKPOINTS = [
  { id: "swimF", label: "スイムF", km: 4, discipline: "swim" },
  { id: "bikeS", label: "バイクS", km: 0, discipline: "bike" },
  { id: "sumiyoshi", label: "住吉", km: 100, discipline: "bike" },
  { id: "runS", label: "ランS（本部）", km: 190, discipline: "bike" },
  { id: "run10", label: "ラン10km", km: 10, discipline: "run" },
  { id: "finish", label: "FINISH", km: 42.2, discipline: "run" },
];

describe("buildAxis", () => {
  it("gives each leg its fixed share of the width and its own kilometre length", () => {
    const axis = buildAxis(CHECKPOINTS, 0, 100);
    expect(axis.swim).toEqual({ x0: 0, x1: 22, km: 4 });
    expect(axis.bike).toEqual({ x0: 22, x1: 70, km: 190 });
    expect(axis.run).toEqual({ x0: 70, x1: 100, km: 42.2 });
  });

  it("puts a transition point on the bike leg", () => {
    const axis = buildAxis([{ id: "t", label: "T", km: 5, discipline: "transition" }], 0, 100);
    expect(axis.bike.km).toBe(5);
  });
});

describe("scaleKm", () => {
  const axis = buildAxis(CHECKPOINTS, 0, 100);

  it("maps kilometres within a leg onto that leg's band", () => {
    expect(scaleKm(axis, "bike", 95)).toBeCloseTo(46, 5);
    expect(scaleKm(axis, "run", 0)).toBe(70);
  });

  it("clamps to the band and survives a leg of unknown length", () => {
    expect(scaleKm(axis, "swim", 99)).toBe(22);
    expect(scaleKm(buildAxis([], 0, 100), "run", 5)).toBe(70);
  });
});

describe("buildTicks", () => {
  it("starts at START and merges points that land on the same pixel", () => {
    const axis = buildAxis(CHECKPOINTS, 0, 100);
    const ticks = buildTicks(CHECKPOINTS, axis);
    expect(ticks[0]?.id).toBe("start");
    // The swim finish and the bike start are the same place on the axis.
    expect(ticks.map((t) => t.id)).not.toContain("bikeS");
    expect(ticks.map((t) => t.id)).toContain("swimF");
  });
});

describe("fitLabels", () => {
  it("keeps labels left to right, dropping any that would touch the one before", () => {
    const wide = labelWidth("ランS（本部）");
    const labels = [
      { key: "a", text: "スイムF", x: 10, anchor: "middle" as const },
      { key: "b", text: "住吉", x: 12, anchor: "middle" as const },
      { key: "c", text: "ランS（本部）", x: 10 + wide * 2, anchor: "middle" as const },
    ];
    expect(fitLabels(labels).map((l) => l.key)).toEqual(["a", "c"]);
  });

  it("never lets the last label be pushed out by an earlier one", () => {
    const labels = [
      { key: "a", text: "スイムF", x: 10, anchor: "middle" as const },
      { key: "z", text: "FINISH", x: 11, anchor: "middle" as const },
    ];
    expect(fitLabels(labels, { keepLast: true }).map((l) => l.key)).toEqual(["z"]);
  });
});

describe("kmTicks", () => {
  it("chooses the coarsest step that leaves room between marks", () => {
    const marks = kmTicks({ x0: 0, x1: 300, km: 42.2 }, 40);
    expect(marks.map((m) => m.km)).toEqual([10, 20, 30, 40]);
    expect(marks[0]?.x).toBeCloseTo(300 * (10 / 42.2), 5);
  });

  it("gives nothing for a leg with no length", () => {
    expect(kmTicks({ x0: 0, x1: 300, km: 0 }, 40)).toEqual([]);
  });
});
