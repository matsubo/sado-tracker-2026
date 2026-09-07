import { derivePassEvents, eventKey } from "@/lib/compute/events";
import type { ComputedSnapshot } from "@/lib/compute/snapshot";
import type { EventsResponseDto } from "./contract";
import { athleteRefLinks } from "./serialize";

const MAX_BIBS = 50;

/** Checkpoint passes for a list of bibs, newest first, capped. */
export function buildEventsResponse(
  snapshot: ComputedSnapshot,
  bibs: readonly string[],
  limit = 100,
): EventsResponseDto {
  const wanted = bibs.slice(0, MAX_BIBS);
  const events = derivePassEvents(snapshot, wanted, limit).map((event) => ({
    key: eventKey(event),
    bib: event.bib,
    name: event.name,
    checkpointId: event.checkpointId,
    checkpointLabel: event.checkpointLabel,
    discipline: event.discipline,
    passedAt: event.passedAt,
    elapsedMs: event.elapsedMs,
    divisionRank: event.divisionRank,
    ageRank: event.ageRank,
    segmentMs: event.segmentMs,
    segmentSpeedKmh: event.segmentSpeedKmh,
    _links: athleteRefLinks(event.bib),
  }));
  return {
    count: events.length,
    events,
    _links: {
      self: {
        href:
          wanted.length === 0
            ? "/api/events"
            : `/api/events?bibs=${encodeURIComponent(wanted.join(","))}`,
      },
    },
  };
}
