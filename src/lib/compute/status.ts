import type { DivisionCourse } from "@/config/races";
import type { Athlete } from "@/lib/domain/types";

export type Status = "finished" | "dnf" | "not_started" | "dns_suspected" | "racing";

const SWIM_EVIDENCE = ["swimL", "swimF", "bikeS"] as const;

/**
 * A DNF remark is authoritative only when there is no finish time: the
 * organizer sometimes leaves a remark on an athlete who later finished.
 */
function hasAbandonRemark(athlete: Athlete): boolean {
  return athlete.remark.trimStart().startsWith("DNF");
}

/**
 * An athlete with no water entry, no swim split and no bike start well after
 * the swim cutoff never started. Around 13 % of entries are in this state,
 * so leaving them as "racing" would fill the course map with athletes who
 * are not there. Water entry is the discriminator: an athlete who entered
 * the water but has no swim split abandoned during the swim and stays racing.
 */
export function athleteStatus(
  athlete: Athlete,
  course: DivisionCourse,
  nowMs: number,
): Status {
  if (athlete.passes.finish !== undefined) return "finished";
  if (hasAbandonRemark(athlete)) return "dnf";
  if (nowMs < athlete.startAt) return "not_started";

  const cutoff = athlete.startAt + course.swimCutoffMin * 60_000;
  if (nowMs > cutoff) {
    const seen =
      athlete.preRace.waterEntry !== undefined ||
      SWIM_EVIDENCE.some((id) => athlete.passes[id] !== undefined);
    if (!seen) return "dns_suspected";
  }

  return "racing";
}

/** Statuses that take part in rankings, the course map and predictions. */
export function isScored(status: Status): boolean {
  return status === "finished" || status === "dnf" || status === "racing";
}
