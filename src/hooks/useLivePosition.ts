"use client";

import { useEffect, useState } from "react";
import type { PositionDto } from "@/lib/api/contract";

const TICK_MS = 10_000;

/**
 * Advance an estimated position between server updates, so the course map
 * keeps moving instead of freezing for a minute. The maths mirrors the
 * server: distance covered at the last known speed, capped at the next
 * timing point.
 */
export function projectKm(position: PositionDto, nowMs: number): number {
  if (position.speedKmh <= 0) return position.estKm;
  const since = nowMs - position.lastAt;
  if (since <= 0) return position.estKm;
  const travelled = (position.speedKmh * since) / 3_600_000;
  const cap = Math.max(position.lastKm, position.capKm - 0.1);
  return Math.min(position.lastKm + travelled, cap);
}

/** A clock that ticks slowly, for components that animate positions. */
export function useLiveClock(intervalMs = TICK_MS): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
