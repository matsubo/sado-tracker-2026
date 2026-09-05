import type { ComputedSnapshot } from "./snapshot";

export interface PassEvent {
  readonly bib: string;
  readonly name: string;
  readonly checkpointId: string;
  readonly checkpointLabel: string;
  readonly discipline: string;
  readonly passedAt: number;
  readonly elapsedMs: number;
  readonly divisionRank: { rank: number; of: number } | null;
  readonly ageRank: { rank: number; of: number } | null;
  readonly segmentMs: number | null;
  readonly segmentSpeedKmh: number | null;
}

/**
 * Every checkpoint the given athletes have passed, newest first. The client
 * decides which are unread by comparing against the set it has already shown,
 * so a checkpoint published late still surfaces rather than being missed by a
 * timestamp comparison.
 */
export function derivePassEvents(
  snapshot: ComputedSnapshot,
  bibs: readonly string[],
  limit = 100,
): PassEvent[] {
  const events: PassEvent[] = [];

  for (const bib of bibs) {
    const computed = snapshot.athletes.get(bib);
    if (!computed) continue;

    for (const split of computed.splits) {
      events.push({
        bib,
        name: computed.athlete.name,
        checkpointId: split.checkpointId,
        checkpointLabel: split.label,
        discipline: split.discipline,
        passedAt: split.passedAt,
        elapsedMs: split.elapsedMs,
        divisionRank: split.cumulativeRanks.division,
        ageRank: split.cumulativeRanks.ageGroup,
        segmentMs: split.segmentMs,
        segmentSpeedKmh: split.segmentSpeedKmh,
      });
    }
  }

  return events.sort((a, b) => b.passedAt - a.passedAt).slice(0, limit);
}

/** Stable key the client stores to remember which events it has shown. */
export function eventKey(event: Pick<PassEvent, "bib" | "checkpointId">): string {
  return `${event.bib}:${event.checkpointId}`;
}
