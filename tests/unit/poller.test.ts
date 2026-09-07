import { describe, expect, it } from "vitest";
import { fetchWindow, pollIntervalMs } from "@/lib/runtime/poller";

describe("pollIntervalMs", () => {
  it("polls the live race once a minute by default", () => {
    expect(pollIntervalMs({})).toBe(60_000);
  });

  it("honours an explicit interval down to the floor", () => {
    expect(pollIntervalMs({ POLL_INTERVAL_MS: "5000" })).toBe(5_000);
    expect(pollIntervalMs({ POLL_INTERVAL_MS: "100" })).toBe(60_000);
    expect(pollIntervalMs({ POLL_INTERVAL_MS: "abc" })).toBe(60_000);
  });

  it("keeps about one frame per five race minutes in replay", () => {
    expect(pollIntervalMs({ REPLAY_START: "2025-09-07T06:00:00+09:00" })).toBe(5_000);
    expect(pollIntervalMs({ REPLAY_START: "2025-09-07T06:00:00+09:00", REPLAY_SPEED: "420" })).toBe(
      714,
    );
    expect(pollIntervalMs({ REPLAY_START: "2025-09-07T06:00:00+09:00", REPLAY_SPEED: "1" })).toBe(
      60_000,
    );
  });
});

describe("fetchWindow", () => {
  it("asks the timing site between 07:00 and 23:00 by default", () => {
    expect(fetchWindow({})).toEqual({ fromHour: 7, toHour: 23 });
  });

  it("reads the hours from the environment", () => {
    expect(fetchWindow({ FETCH_FROM_HOUR: "6", FETCH_TO_HOUR: "22" })).toEqual({
      fromHour: 6,
      toHour: 22,
    });
  });

  it("is open around the clock when switched off, in replay, or when misconfigured", () => {
    expect(fetchWindow({ FETCH_WINDOW: "off" })).toBeNull();
    expect(fetchWindow({ FETCH_WINDOW: "OFF" })).toBeNull();
    expect(fetchWindow({ REPLAY_START: "2025-09-07T06:00:00+09:00" })).toBeNull();
    expect(fetchWindow({ FETCH_FROM_HOUR: "seven" })).toBeNull();
  });
});
