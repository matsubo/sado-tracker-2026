"use client";

import { useEffect, useState } from "react";
import type { PositionDto } from "@/lib/api/contract";
import { raceNow } from "@/lib/runtime/raceClock";

const TICK_MS = 10_000;

/**
 * Advance an estimated position between server updates, so the course map
 * keeps moving instead of freezing for a minute. The maths mirrors the
 * server: distance covered at the last known speed, capped at the next
 * timing point.
 */
export function projectKm(position: PositionDto, nowMs: number): number {
  // Before the clock is known the server's own estimate is the best answer.
  if (nowMs === 0 || position.speedKmh <= 0) return position.estKm;
  const since = nowMs - position.lastAt;
  if (since <= 0) return position.estKm;
  const travelled = (position.speedKmh * since) / 3_600_000;
  const cap = Math.max(position.lastKm, position.capKm - 0.1);
  return Math.min(position.lastKm + travelled, cap);
}

/**
 * A slow clock on the race's timeline, for components that animate positions.
 * It starts at zero so the server and client render identical markup, then
 * takes the race clock once mounted.
 */
export function useLiveClock(intervalMs = TICK_MS): number {
  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(raceNow());
    const timer = setInterval(() => setNow(raceNow()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
