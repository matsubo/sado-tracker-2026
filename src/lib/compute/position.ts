import type { CheckpointDef, Discipline, DivisionCourse } from "@/config/races";
import type { Athlete } from "@/lib/domain/types";
import { disciplineKm, splitBetween } from "./elapsed";
import { checkpointIndex, latestCheckpoint, type Populations } from "./population";
import { athleteStatus, isScored } from "./status";

/** Stop just short of the next timing point: the athlete has not reached it. */
const CHECKPOINT_MARGIN_KM = 0.1;
const MIN_MEDIAN_SAMPLE = 5;

export interface PositionEstimate {
  readonly discipline: Discipline;
  readonly lastCheckpoint: string | null;
  readonly lastCheckpointLabel: string | null;
  /** Kilometres within `discipline` at the last recorded checkpoint. */
  readonly lastKm: number;
  /** Epoch milliseconds of that checkpoint, or the wave start. */
  readonly lastAt: number;
  readonly speedKmh: number;
  /** Upper bound for the estimate: the next checkpoint, less a margin. */
  readonly capKm: number;
  readonly estKm: number;
  readonly totalKm: number;
  /** True when the estimate has hit the cap and we are waiting for a split. */
  readonly waiting: boolean;
  /** True between the swim finish and the bike start. */
  readonly inTransition: boolean;
  readonly source: "own" | "live-median" | "history-median" | "none";
}

/** Advance from a known point at a known speed, without passing the cap. */
export function projectKm(lastKm: number, speedKmh: number, sinceMs: number, capKm: number): number {
  if (sinceMs <= 0 || speedKmh <= 0) return lastKm;
  const travelled = (speedKmh * sinceMs) / 3_600_000;
  return Math.min(lastKm + travelled, Math.max(lastKm, capKm - CHECKPOINT_MARGIN_KM));
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] as number;
  return (((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2);
}

function speedKmh(km: number, ms: number): number | null {
  if (km <= 0 || ms <= 0) return null;
  return km / (ms / 3_600_000);
}

/** Checkpoints of one discipline, in course order. */
function checkpointsOf(course: DivisionCourse, discipline: Discipline): CheckpointDef[] {
  return course.checkpoints.filter((c) => c.discipline === discipline && c.id !== "start");
}

/**
 * The speed the field is holding on the segment that starts at `fromId`,
 * used when the athlete has not completed a segment of their own yet.
 */
function fieldMedianSpeed(
  pop: Populations,
  fromId: string,
  toId: string,
  distanceKm: number,
): number | null {
  const speeds: number[] = [];
  for (const other of pop.atCheckpoint(toId)) {
    const ms = splitBetween(other, fromId, toId);
    const value = ms === null ? null : speedKmh(distanceKm, ms);
    if (value !== null) speeds.push(value);
  }
  return speeds.length >= MIN_MEDIAN_SAMPLE ? median(speeds) : null;
}

interface Anchor {
  readonly discipline: Discipline;
  readonly checkpoint: CheckpointDef | null;
  readonly km: number;
  readonly at: number;
}

/**
 * Where the athlete was last measured, expressed on the leg they are now on.
 * Two checkpoints sit on a boundary and must be read forwards, not backwards:
 * `swimF` ends the swim and puts the athlete in T1 at bike km 0, and `runS`
 * ends the bike and puts them on the run at km 0. Reading either as the end
 * of the leg it closes would park the athlete at the far end of a leg they
 * have already finished.
 */
function findAnchor(athlete: Athlete, course: DivisionCourse): Anchor {
  const latest = latestCheckpoint(athlete, course);
  if (latest === null) {
    return { discipline: "swim", checkpoint: null, km: 0, at: athlete.startAt };
  }

  const checkpoint = course.checkpoints.find((c) => c.id === latest) as CheckpointDef;
  const at = athlete.passes[latest] as number;

  if (checkpoint.id === "runS") {
    return { discipline: "run", checkpoint, km: 0, at };
  }

  return {
    discipline: checkpoint.discipline === "transition" ? "bike" : checkpoint.discipline,
    checkpoint,
    km: checkpoint.km,
    at,
  };
}

/**
 * Estimate where an athlete is on the course. The estimate advances from the
 * last recorded checkpoint at the athlete's own recent speed, falling back to
 * the field median, and is capped at the next timing point because passing it
 * would have produced a record.
 */
export function estimatePosition(
  athlete: Athlete,
  course: DivisionCourse,
  pop: Populations,
  nowMs: number,
  historyMedianSpeedKmh?: Partial<Record<Discipline, number>>,
): PositionEstimate {
  const status = athleteStatus(athlete, course, nowMs);
  const anchor = findAnchor(athlete, course);

  if (status === "finished") {
    return {
      discipline: "run",
      lastCheckpoint: "finish",
      lastCheckpointLabel: "FINISH",
      lastKm: course.runKm,
      lastAt: athlete.passes.finish as number,
      speedKmh: 0,
      capKm: course.runKm,
      estKm: course.runKm,
      totalKm: course.runKm,
      waiting: false,
      inTransition: false,
      source: "none",
    };
  }

  // Between swimF and bikeS the athlete is in T1, at the start of the bike.
  const inTransition = anchor.checkpoint?.id === "swimF";
  const discipline: Discipline = inTransition ? "bike" : anchor.discipline;
  const legCheckpoints = checkpointsOf(course, discipline);
  const anchorKm = inTransition ? 0 : anchor.km;

  const next = legCheckpoints.find((c) => c.km > anchorKm);
  const capKm = next?.km ?? disciplineKm(discipline, course);

  let speed: number | null = null;
  let source: PositionEstimate["source"] = "none";

  if (!inTransition && anchor.checkpoint && anchor.checkpoint.id !== "runS") {
    const index = checkpointIndex(course, anchor.checkpoint.id);
    const previous = course.checkpoints[index - 1];
    if (previous && previous.discipline === anchor.checkpoint.discipline) {
      const ms = splitBetween(athlete, previous.id, anchor.checkpoint.id);
      speed = ms === null ? null : speedKmh(anchor.checkpoint.km - previous.km, ms);
      if (speed !== null) source = "own";
    } else if (previous && anchor.checkpoint.discipline === "bike") {
      const ms = splitBetween(athlete, "bikeS", anchor.checkpoint.id);
      speed = ms === null ? null : speedKmh(anchor.checkpoint.km, ms);
      if (speed !== null) source = "own";
    }
  }

  if (speed === null && next && anchor.checkpoint) {
    const fieldSpeed = fieldMedianSpeed(pop, anchor.checkpoint.id, next.id, next.km - anchorKm);
    if (fieldSpeed !== null) {
      speed = fieldSpeed;
      source = "live-median";
    }
  }

  if (speed === null) {
    const historical = historyMedianSpeedKmh?.[discipline];
    if (historical !== undefined && historical > 0) {
      speed = historical;
      source = "history-median";
    }
  }

  const estKm =
    status === "not_started" || inTransition || speed === null
      ? anchorKm
      : projectKm(anchorKm, speed, nowMs - anchor.at, capKm);

  return {
    discipline,
    lastCheckpoint: anchor.checkpoint?.id ?? null,
    lastCheckpointLabel: anchor.checkpoint?.label ?? null,
    lastKm: anchorKm,
    lastAt: anchor.at,
    speedKmh: speed ?? 0,
    capKm,
    estKm,
    totalKm: disciplineKm(discipline, course),
    waiting: estKm >= capKm - CHECKPOINT_MARGIN_KM && capKm > anchorKm,
    inTransition,
    source,
  };
}

/**
 * A single order over the whole field, needed because cumulative ranks are
 * only comparable within one checkpoint. Athletes further along the course
 * lead; among those at the same checkpoint, the faster one leads.
 */
export function fieldOrder(
  athletes: readonly Athlete[],
  course: DivisionCourse,
  nowMs: number,
): string[] {
  const scored = athletes.filter((a) => isScored(athleteStatus(a, course, nowMs)));

  return scored
    .map((athlete) => {
      const latest = latestCheckpoint(athlete, course);
      const index = latest === null ? -1 : checkpointIndex(course, latest);
      const at = latest === null ? athlete.startAt : (athlete.passes[latest] as number);
      return { bib: athlete.bib, index, elapsed: at - athlete.startAt };
    })
    .sort((a, b) => (a.index === b.index ? a.elapsed - b.elapsed : b.index - a.index))
    .map((entry) => entry.bib);
}
