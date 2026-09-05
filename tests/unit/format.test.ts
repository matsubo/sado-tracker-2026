import { describe, expect, it } from "vitest";
import {
  formatBikeSpeed,
  formatClock,
  formatClockShort,
  formatDateTime,
  formatDeviation,
  formatDiff,
  formatDuration,
  formatDurationShort,
  formatKm,
  formatRank,
  formatRankOrDash,
  formatRunPace,
  formatSpeedKmh,
  formatSwimPace,
} from "@/lib/format";

const DASH = "—";
const MINUS = "−";

// Reference epochs, each verified against Intl before being hard-coded here.
const NOON_JST = 1_788_577_200_000; // 2026-09-05T03:00:00Z -> 12:00:00 JST
const MIDNIGHT_JST = 1_788_534_000_000; // 2026-09-04T15:00:00Z -> 00:00:00 JST on 9/5, h23 vs h24
const MORNING_JST = 1_788_566_707_000; // 2026-09-05T00:05:07Z -> 09:05:07 JST, zero padding

describe("formatDuration", () => {
  it("renders h:mm:ss with unpadded hours", () => {
    expect(formatDuration(15_154_000)).toBe("4:12:34");
    expect(formatDuration(0)).toBe("0:00:00");
    expect(formatDuration(3_600_000)).toBe("1:00:00");
  });

  it("truncates the sub-second part instead of rounding", () => {
    expect(formatDuration(3_661_999)).toBe("1:01:01");
    expect(formatDuration(999)).toBe("0:00:00");
  });

  it("does not wrap hours past 24", () => {
    expect(formatDuration(99_999_999)).toBe("27:46:39");
  });

  it("returns a dash for negative or non-finite input", () => {
    expect(formatDuration(-1)).toBe(DASH);
    expect(formatDuration(Number.NaN)).toBe(DASH);
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe(DASH);
  });
});

describe("formatDurationShort", () => {
  it("renders h:mm at or above one hour", () => {
    expect(formatDurationShort(15_154_000)).toBe("4:12");
    expect(formatDurationShort(3_600_000)).toBe("1:00");
  });

  it("renders m:ss below one hour", () => {
    expect(formatDurationShort(2_553_000)).toBe("42:33");
    expect(formatDurationShort(3_599_999)).toBe("59:59");
    expect(formatDurationShort(0)).toBe("0:00");
    expect(formatDurationShort(63_000)).toBe("1:03");
  });

  it("returns a dash for negative or non-finite input", () => {
    expect(formatDurationShort(-5)).toBe(DASH);
    expect(formatDurationShort(Number.NaN)).toBe(DASH);
  });
});

describe("formatDiff", () => {
  it("returns a dash for a zero or non-finite difference", () => {
    expect(formatDiff(0)).toBe(DASH);
    expect(formatDiff(Number.NaN)).toBe(DASH);
    expect(formatDiff(Number.NEGATIVE_INFINITY)).toBe(DASH);
  });

  it("prefixes a positive difference with a plus sign", () => {
    expect(formatDiff(221_000)).toBe("+3:41");
    expect(formatDiff(3_723_000)).toBe("+1:02:03");
  });

  it("switches to h:mm:ss at exactly one hour", () => {
    expect(formatDiff(3_599_000)).toBe("+59:59");
    expect(formatDiff(3_600_000)).toBe("+1:00:00");
    expect(formatDiff(-3_600_000)).toBe(`${MINUS}1:00:00`);
  });

  it("uses U+2212 MINUS SIGN for a negative difference", () => {
    const negative = formatDiff(-35_000);
    expect(negative).toBe(`${MINUS}0:35`);
    expect(negative.charCodeAt(0)).toBe(0x2212);
    expect(negative.startsWith("-")).toBe(false);
  });

  it("truncates a negative difference toward zero", () => {
    expect(formatDiff(-35_500)).toBe(`${MINUS}0:35`);
  });
});

describe("clock formatting in Asia/Tokyo", () => {
  it("renders the Tokyo wall-clock time as HH:MM:SS", () => {
    const reference = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      hourCycle: "h23",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(NOON_JST));

    expect(formatClock(NOON_JST)).toBe("12:00:00");
    expect(formatClock(NOON_JST)).toBe(reference);
  });

  it("renders midnight as 00, not 24", () => {
    expect(formatClock(MIDNIGHT_JST)).toBe("00:00:00");
  });

  it("zero-pads hours, minutes and seconds", () => {
    expect(formatClock(MORNING_JST)).toBe("09:05:07");
    expect(formatClockShort(MORNING_JST)).toBe("09:05");
  });

  it("renders HH:MM for the short form", () => {
    expect(formatClockShort(NOON_JST)).toBe("12:00");
    expect(formatClockShort(MIDNIGHT_JST)).toBe("00:00");
  });

  it("renders M/D HH:MM for the date-time form", () => {
    expect(formatDateTime(NOON_JST)).toBe("9/5 12:00");
    expect(formatDateTime(MIDNIGHT_JST)).toBe("9/5 00:00");
    expect(formatDateTime(MORNING_JST)).toBe("9/5 09:05");
  });
});

describe("formatSwimPace", () => {
  it("renders m:ss per 100m", () => {
    expect(formatSwimPace(5_025_000, 4.0)).toBe("2:05 /100m");
  });

  it("returns a dash for a non-positive distance or an unusable time", () => {
    expect(formatSwimPace(5_025_000, 0)).toBe(DASH);
    expect(formatSwimPace(5_025_000, -1)).toBe(DASH);
    expect(formatSwimPace(-1, 4.0)).toBe(DASH);
    expect(formatSwimPace(Number.NaN, 4.0)).toBe(DASH);
  });
});

describe("formatBikeSpeed", () => {
  it("renders one decimal place", () => {
    expect(formatBikeSpeed(21_300_000, 190)).toBe("32.1 km/h");
  });

  it("returns a dash when time or distance is not positive", () => {
    expect(formatBikeSpeed(0, 190)).toBe(DASH);
    expect(formatBikeSpeed(21_300_000, 0)).toBe(DASH);
    expect(formatBikeSpeed(Number.NaN, 190)).toBe(DASH);
  });
});

describe("formatRunPace", () => {
  it("renders m:ss per km and dashes a non-positive distance", () => {
    expect(formatRunPace(2_780_000, 10)).toBe("4:38 /km");
    expect(formatRunPace(2_780_000, 0)).toBe(DASH);
  });
});

describe("formatSpeedKmh and formatKm", () => {
  it("renders a speed with one decimal place", () => {
    expect(formatSpeedKmh(32.14)).toBe("32.1 km/h");
    expect(formatSpeedKmh(0)).toBe("0.0 km/h");
    expect(formatSpeedKmh(Number.NaN)).toBe(DASH);
  });

  it("renders a distance with the requested precision", () => {
    expect(formatKm(132)).toBe("132 km");
    expect(formatKm(15.6, 1)).toBe("15.6 km");
    expect(formatKm(3.8)).toBe("4 km");
    expect(formatKm(Number.NaN)).toBe(DASH);
  });
});

describe("rank formatting", () => {
  it("renders rank over field size", () => {
    expect(formatRank(201, 412)).toBe("201/412");
    expect(formatRankOrDash(201, 412)).toBe("201/412");
  });

  it("returns a dash when either side is null", () => {
    expect(formatRankOrDash(null, 412)).toBe(DASH);
    expect(formatRankOrDash(201, null)).toBe(DASH);
    expect(formatRankOrDash(null, null)).toBe(DASH);
  });

  it("renders a deviation score as an integer", () => {
    expect(formatDeviation(58)).toBe("58");
    expect(formatDeviation(58.7)).toBe("59");
    expect(formatDeviation(null)).toBe(DASH);
  });
});
