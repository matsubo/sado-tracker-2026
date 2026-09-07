import type { DivisionCourse } from "@/config/races";
import type { Athlete } from "@/lib/domain/types";

export type Status = "finished" | "dnf" | "not_started" | "dns_suspected" | "racing";

const SWIM_EVIDENCE = ["swimL", "swimF", "bikeS"] as const;

/**
 * The organiser records a retirement in the remark column, but not always at
 * the front of it: "runDNF", "bikeDNF 水津TOV" and "swimSKIP, DNF/本部(16:23)"
 * are all shapes it takes. Matching only a prefix missed 26 of the 160
 * retirements in 2026, who then showed as still racing.
 *
 * A finish is checked before this, so a remark on someone who later finished
 * cannot retire them.
 */
function hasAbandonRemark(athlete: Athlete): boolean {
  return athlete.remark.includes("DNF");
}

/** Anything that shows the athlete actually set off. */
function startedRacing(athlete: Athlete): boolean {
  return (
    athlete.preRace.waterEntry !== undefined ||
    SWIM_EVIDENCE.some((id) => athlete.passes[id] !== undefined) ||
    Object.keys(athlete.passes).length > 0
  );
}

/**
 * Where an athlete stands.
 *
 * DNS is an entrant who never set off: the timing system stamps START on
 * every entry whether or not they turned up, so the evidence has to be a
 * reading on the course or in the water. Around 190 of the 1,890 entries in
 * 2026 were in this state, and leaving them as racing filled the course map
 * with people who were not there.
 *
 * DNF is an entrant who did set off and did not finish. Usually the organiser
 * says so in the remark, but not always: fourteen athletes in 2026 simply
 * stopped appearing, with the last of them measured at ラン34km. Nothing in
 * the file marks them, so `raceEndedAt` does: once the race is over, anyone
 * on the course without a finish is not going to get one.
 */
export function athleteStatus(
  athlete: Athlete,
  course: DivisionCourse,
  nowMs: number,
  raceEndedAt: number | null = null,
): Status {
  if (athlete.passes.finish !== undefined) return "finished";
  if (hasAbandonRemark(athlete)) return "dnf";
  if (nowMs < athlete.startAt) return "not_started";

  const raceOver = raceEndedAt !== null && nowMs >= raceEndedAt;
  const cutoff = athlete.startAt + course.swimCutoffMin * 60_000;

  if (raceOver || nowMs > cutoff) {
    if (!startedRacing(athlete)) return "dns_suspected";
  }
  if (raceOver) return "dnf";

  return "racing";
}

/** Statuses that take part in rankings, the course map and predictions. */
export function isScored(status: Status): boolean {
  return status === "finished" || status === "dnf" || status === "racing";
}
