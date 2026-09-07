import { describe, expect, it } from "vitest";
import { getRaceConfig } from "@/config/races";
import { disciplineTime, elapsedAt, splitBetween } from "@/lib/compute/elapsed";
import { buildPopulations, latestCheckpoint } from "@/lib/compute/population";
import { athleteStatus } from "@/lib/compute/status";
import type { Athlete } from "@/lib/domain/types";
import { loadFixtureSnapshot } from "@/lib/testing/fixtures";

const config = getRaceConfig(2026);
const courseA = config.divisions.A;
const courseB = config.divisions.B;
const START_A = Date.parse("2026-09-06T06:00:00+09:00");
const MINUTE = 60_000;

function athlete(overrides: Partial<Athlete> = {}): Athlete {
  return {
    bib: "1",
    name: "テスト　太郎",
    nameKey: "テスト 太郎",
    sex: "M",
    division: "A",
    ageGroup: { id: "M40-44", sex: "M", min: 40, max: 44, label: "男子40-44" },
    startAt: START_A,
    startInferred: false,
    passes: {},
    preRace: {},
    officialTotal: null,
    remark: "",
    ...overrides,
  };
}

describe("elapsedAt and splitBetween", () => {
  const a = athlete({ passes: { swimF: START_A + 80 * MINUTE, bikeS: START_A + 88 * MINUTE } });

  it("measures from the wave start", () => {
    expect(elapsedAt(a, "swimF")).toBe(80 * MINUTE);
  });

  it("returns null for a checkpoint the athlete has not reached", () => {
    expect(elapsedAt(a, "finish")).toBeNull();
  });

  it("measures the gap between two checkpoints", () => {
    expect(splitBetween(a, "swimF", "bikeS")).toBe(8 * MINUTE);
  });

  it("returns null when either end is missing", () => {
    expect(splitBetween(a, "bikeS", "runS")).toBeNull();
  });
});

describe("disciplineTime", () => {
  const finisher = athlete({
    passes: {
      swimF: START_A + 90 * MINUTE,
      bikeS: START_A + 98 * MINUTE,
      runS: START_A + 540 * MINUTE,
      finish: START_A + 840 * MINUTE,
    },
  });

  it("takes swim from the start to the swim finish", () => {
    expect(disciplineTime(finisher, "swim", courseA)).toBe(90 * MINUTE);
  });

  it("takes bike from the bike start to the run start, excluding T1", () => {
    expect(disciplineTime(finisher, "bike", courseA)).toBe(442 * MINUTE);
  });

  it("takes run from the run start to the finish", () => {
    expect(disciplineTime(finisher, "run", courseA)).toBe(300 * MINUTE);
  });

  it("returns null while the discipline is still in progress", () => {
    const midBike = athlete({
      passes: { swimF: START_A + 90 * MINUTE, bikeS: START_A + 98 * MINUTE },
    });
    expect(disciplineTime(midBike, "bike", courseA)).toBeNull();
  });
});

describe("athleteStatus", () => {
  const now = START_A + 300 * MINUTE;

  it("is finished when a finish time exists, even with a DNF remark", () => {
    const a = athlete({ passes: { finish: START_A + 800 * MINUTE }, remark: "DNF/本部(20:24)" });
    expect(athleteStatus(a, courseA, now)).toBe("finished");
  });

  it("is dnf wherever DNF sits in the remark, not only at the front", () => {
    // The organiser writes the leg first as often as not, and sometimes lists
    // an earlier note before it. 26 of the 160 retirements in 2026 were
    // recorded in one of these shapes.
    for (const remark of [
      "DNF/本部(20:24)",
      "runDNF",
      "bikeDNF",
      "bikeDNF 水津TOV",
      "bikeDNF（水津10:12）, DNF/水津AS(10:08)",
      "swimSKIP, DNF/本部(16:23)",
      "swimDNF, DNF/本部(08:14)",
      "runSKIP, DNF/本部(08:21)",
      "TOVrunDNF",
      "  DNF/本部(19:37)",
    ]) {
      const a = athlete({ remark, passes: { swimF: now - 3_600_000 } });
      expect(athleteStatus(a, courseA, now), remark).toBe("dnf");
    }
  });

  it("leaves a remark that never mentions DNF alone", () => {
    for (const remark of ["PNLT+5分", "swimSKIP", "TOV", "入水チェック手動", ""]) {
      const a = athlete({ remark, passes: { swimF: now - 3_600_000 } });
      expect(athleteStatus(a, courseA, now), remark).not.toBe("dnf");
    }
  });

  it("is dnf once the race is over and a measured athlete has no finish", () => {
    // Bib 1290 in 2026: last seen at ラン34km at 20:45, no finish, no remark.
    // The organiser writes nothing for a cut-off, so the race ending is the
    // only signal that they will not be crossing the line.
    const a = athlete({ passes: { swimF: START_A + 30 * MINUTE, run34: START_A + 855 * MINUTE } });
    const raceOver = START_A + 16 * 60 * MINUTE;
    expect(athleteStatus(a, courseA, raceOver - MINUTE, raceOver)).toBe("racing");
    expect(athleteStatus(a, courseA, raceOver, raceOver)).toBe("dnf");
  });

  it("leaves an athlete who was never measured as dns, not dnf", () => {
    const a = athlete({ passes: {} });
    const raceOver = START_A + 16 * 60 * MINUTE;
    expect(athleteStatus(a, courseA, raceOver, raceOver)).toBe("dns_suspected");
  });

  it("keeps a finisher finished after the race is over", () => {
    const a = athlete({ passes: { finish: START_A + 600 * MINUTE } });
    const raceOver = START_A + 16 * 60 * MINUTE;
    expect(athleteStatus(a, courseA, raceOver, raceOver)).toBe("finished");
  });

  it("is dnf when the remark says so and there is no finish", () => {
    const a = athlete({ passes: { sumiyoshi: START_A + 250 * MINUTE }, remark: "DNF/本部(20:24)" });
    expect(athleteStatus(a, courseA, now)).toBe("dnf");
  });

  it("is not started before the wave start", () => {
    expect(athleteStatus(athlete(), courseA, START_A - MINUTE)).toBe("not_started");
  });

  it("is racing while the swim cutoff has not passed", () => {
    const a = athlete();
    expect(athleteStatus(a, courseA, START_A + 149 * MINUTE)).toBe("racing");
  });

  it("is a suspected no-show once the swim cutoff passes with no sign of the athlete", () => {
    const a = athlete();
    expect(athleteStatus(a, courseA, START_A + 151 * MINUTE)).toBe("dns_suspected");
  });

  it("stays racing after the cutoff when the athlete entered the water", () => {
    const a = athlete({ preRace: { waterEntry: START_A - 15 * MINUTE } });
    expect(athleteStatus(a, courseA, START_A + 200 * MINUTE)).toBe("racing");
  });

  it("stays racing after the cutoff when a swim split exists", () => {
    const a = athlete({ passes: { swimL: START_A + 60 * MINUTE } });
    expect(athleteStatus(a, courseA, START_A + 200 * MINUTE)).toBe("racing");
  });

  it("uses the shorter B cutoff", () => {
    const b = athlete({ division: "B" });
    expect(athleteStatus(b, courseB, START_A + 99 * MINUTE)).toBe("racing");
    expect(athleteStatus(b, courseB, START_A + 101 * MINUTE)).toBe("dns_suspected");
  });
});

describe("latestCheckpoint", () => {
  it("returns the furthest point along the course, not the most recent timestamp", () => {
    const a = athlete({
      passes: {
        swimF: START_A + 90 * MINUTE,
        bikeS: START_A + 98 * MINUTE,
        sumiyoshi: START_A + 300 * MINUTE,
      },
    });
    expect(latestCheckpoint(a, courseA)).toBe("sumiyoshi");
  });

  it("returns null when nothing has been recorded", () => {
    expect(latestCheckpoint(athlete(), courseA)).toBeNull();
  });
});

describe("buildPopulations", () => {
  const now = START_A + 300 * MINUTE;
  const racing = athlete({ bib: "1", passes: { swimF: START_A + 90 * MINUTE } });
  const dnf = athlete({
    bib: "2",
    passes: { swimF: START_A + 95 * MINUTE },
    remark: "DNF/本部(15:00)",
  });
  const noShow = athlete({ bib: "3" });
  const other = athlete({ bib: "4", division: "B" });

  it("groups by checkpoint within one division", () => {
    const pop = buildPopulations([racing, dnf, noShow, other], "A", courseA, now);
    expect(pop.atCheckpoint("swimF").map((a) => a.bib)).toEqual(["1", "2"]);
  });

  it("keeps athletes who abandoned later in the checkpoints they did reach", () => {
    const pop = buildPopulations([racing, dnf], "A", courseA, now);
    expect(pop.atCheckpoint("swimF")).toHaveLength(2);
  });

  it("excludes suspected no-shows entirely", () => {
    const pop = buildPopulations([racing, noShow], "A", courseA, now);
    expect(pop.all.map((a) => a.bib)).toEqual(["1"]);
  });

  it("counts a real division from the fixture data", () => {
    const snapshot = loadFixtureSnapshot(2025);
    const raceDay = Date.parse("2025-09-07T23:00:00+09:00");
    const courseA2025 = getRaceConfig(2025).divisions.A;
    const pop = buildPopulations(
      snapshot.athletes.filter((a) => a.division === "A"),
      "A",
      courseA2025,
      raceDay,
    );
    expect(pop.atCheckpoint("finish").length).toBe(565);
    expect(pop.atCheckpoint("swimF").length).toBeGreaterThan(800);
  });
});
