import type { RaceStateDto } from "@/lib/api/contract";

/** The two waves worth naming; the relay divisions go off with them. */
const HEADLINE: readonly string[] = ["A", "B"];

/**
 * "Aタイプは 06:30、Bタイプは 08:00 にスタートします。"
 *
 * Built from the race the server is actually serving rather than written out,
 * because the organiser moves the start on the morning when the sea demands
 * it, and a sentence that has to be edited by hand is a sentence that will be
 * wrong on the one day it is read.
 */
export function waveStartSentence(race: RaceStateDto | null): string | null {
  if (!race) return null;
  const waves = HEADLINE.map((id) => race.divisions.find((d) => d.id === id)).filter(
    (d): d is NonNullable<typeof d> => d !== undefined && d.entrants > 0,
  );
  if (waves.length === 0) return null;
  const parts = waves.map((wave) => `${wave.label}は ${wave.waveStart}`);
  return `${parts.join("、")} にスタートします。`;
}
