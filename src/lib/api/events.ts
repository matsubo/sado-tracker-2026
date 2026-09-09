import { derivePassEvents, eventKey } from "@/lib/compute/events";
import type { ComputedSnapshot } from "@/lib/compute/snapshot";
import type { EventsResponseDto } from "./contract";
import { eventsHref } from "./eventsLink";
import { athleteRefLinks } from "./serialize";

const MAX_BIBS = 50;

/**
 * More timing points than any course has, so the answer below holds an
 * athlete's whole race; see config/races/courses.ts, and the test that keeps
 * the two in step.
 */
const MAX_PASSES_PER_ATHLETE = 20;

/**
 * Every checkpoint the given athletes have passed, newest first.
 *
 * Complete for each athlete asked for, never the newest hundred across them
 * all: the client folds an athlete's race so far into what it has read the
 * first time an answer accounts for them, so a pass left out here would come
 * back as news the moment the list is short enough to let it in. What that
 * costs is bounded by how many athletes one browser can follow.
 */
export function buildEventsResponse(
  snapshot: ComputedSnapshot,
  bibs: readonly string[],
): EventsResponseDto {
  const wanted = bibs.slice(0, MAX_BIBS);
  const limit = wanted.length * MAX_PASSES_PER_ATHLETE;
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
  // The self link names exactly who was asked for, which is how a client
  // tells "this athlete has no passes yet" from "this answer predates them".
  return {
    count: events.length,
    events,
    _links: { self: { href: eventsHref(wanted) } },
  };
}
