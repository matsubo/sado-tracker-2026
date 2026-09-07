"use client";

import { useContext } from "react";
import type { PositionDto } from "@/lib/api/contract";
import { LiveClockContext } from "@/state/LiveClockProvider";

/**
 * Advance an estimated position between server updates, so the course keeps
 * moving instead of freezing for a minute. This mirrors the server exactly,
 * which is why it must run on the race clock rather than the device clock:
 * given the same instant, client and server produce the same kilometre.
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

/** The shared race-time clock; see LiveClockProvider. Zero until known. */
export function useLiveClock(): number {
  const value = useContext(LiveClockContext);
  if (value === null) throw new Error("useLiveClock must be used within LiveClockProvider");
  return value;
}
