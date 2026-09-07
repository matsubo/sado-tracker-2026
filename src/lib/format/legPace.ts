import type { DisciplineDto } from "@/lib/api/contract";
import { formatBikeSpeed, formatRunPace, formatSpeedKmh, formatSwimPace } from "./pace";

const DASH = "—";

/**
 * Pace or speed for a leg, in the unit that discipline is usually read in.
 *
 * The distance comes from the leg itself: a leg still being raced carries the
 * distance to the checkpoint reached, not the whole leg, so the pace is taken
 * against the ground actually covered.
 */
export function legPaceText(row: DisciplineDto): string {
  if (row.timeMs === null) return DASH;
  if (row.discipline === "bike" && row.speedKmh !== null) return formatSpeedKmh(row.speedKmh);
  if (row.measuredKm <= 0) return DASH;
  if (row.discipline === "swim") return formatSwimPace(row.timeMs, row.measuredKm);
  if (row.discipline === "bike") return formatBikeSpeed(row.timeMs, row.measuredKm);
  return formatRunPace(row.timeMs, row.measuredKm);
}
