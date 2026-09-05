import type { Discipline, DivisionCourse } from "@/config/races";
import type { Athlete } from "@/lib/domain/types";
import type { NeighbourModel, TrainingRow } from "@/lib/history/model";
import { disciplineKm, splitBetween } from "./elapsed";
import { checkpointIndex, latestCheckpoint, type Populations } from "./population";
import { athleteStatus } from "./status";

const NEIGHBOUR_COUNT = 20;
const MIN_NEIGHBOURS = 5;

export interface PredictionExplanation {
  readonly neighbourCount: number;
  readonly yearBreakdown: Readonly<Record<number, number>>;
  readonly remainingP25Ms: number;
  readonly remainingMedianMs: number;
  readonly remainingP75Ms: number;
  /** The athlete's speed on their most recent measured segment, km/h. */
  readonly ownSpeedKmh: number | null;
  /** The neighbours' median speed on the same segment, km/h. */
  readonly neighbourSpeedKmh: number | null;
  /** What a plain distance-over-current-speed extrapolation would give. */
  readonly extrapolationMs: number | null;
  readonly backtestMedianErrorMs: number | null;
  readonly backtestWithin25MinPct: number | null;
  readonly note: string;
}

export interface Prediction {
  readonly method: "neighbours" | "extrapolation";
  readonly atCheckpoint: string;
  readonly atCheckpointLabel: string;
  /** Predicted wall-clock finish, epoch milliseconds. */
  readonly finishAt: number;
  /** Predicted total race time, milliseconds. */
  readonly totalMs: number;
  readonly rangeLowMs: number;
  readonly rangeHighMs: number;
  readonly explanation: PredictionExplanation;
}

export interface BacktestAccuracy {
  readonly medianErrorMs: number;
  readonly within25MinPct: number;
  readonly sampleSize: number;
}

export type BacktestTable = ReadonlyMap<string, BacktestAccuracy>;

function percentile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * fraction)));
  return sorted[index] as number;
}

function paceMinPerKm(ms: number, km: number): number | null {
  if (ms <= 0 || km <= 0) return null;
  return ms / 60_000 / km;
}

/**
 * Percentile of an athlete's pace within the live field, so a discipline
 * whose distance changed between years can still be compared. Returns null
 * until enough of the field has been measured for a rank to mean anything.
 */
function livePercentile(
  athlete: Athlete,
  discipline: Discipline,
  course: DivisionCourse,
  pop: Populations,
): number | null {
  const bounds =
    discipline === "swim"
      ? (["start", "swimF"] as const)
      : discipline === "bike"
        ? (["bikeS", "runS"] as const)
        : (["runS", "finish"] as const);

  const own = splitBetween(athlete, bounds[0], bounds[1]);
  if (own === null) return null;

  const times = pop
    .atCheckpoint(bounds[1])
    .map((other) => splitBetween(other, bounds[0], bounds[1]))
    .filter((value): value is number => value !== null);
  if (times.length < 20) return null;

  const ahead = times.filter((value) => value < own).length;
  return ahead / (times.length - 1);
}

/** The athlete's pace on each discipline they have finished, plus the one in progress. */
function featureVector(
  athlete: Athlete,
  course: DivisionCourse,
  latest: string,
  features: readonly Discipline[],
  paceComparable: (discipline: Discipline) => boolean,
): Map<string, number> {
  const vector = new Map<string, number>();

  for (const discipline of features) {
    const bounds =
      discipline === "swim"
        ? (["start", "swimF"] as const)
        : discipline === "bike"
          ? (["bikeS", "runS"] as const)
          : (["runS", "finish"] as const);
    const ms = splitBetween(athlete, bounds[0], bounds[1]);
    if (ms === null) continue;
    const pace = paceMinPerKm(ms, disciplineKm(discipline, course));
    if (pace !== null) vector.set(discipline, pace);
  }

  // Progress inside the discipline the athlete is currently on. A partial
  // pace is only usable when that discipline's distance matches across the
  // years being compared; otherwise the percentile feature carries it.
  const checkpoint = course.checkpoints.find((c) => c.id === latest);
  if (
    checkpoint &&
    checkpoint.discipline !== "transition" &&
    paceComparable(checkpoint.discipline) &&
    !vector.has(checkpoint.discipline)
  ) {
    const from = checkpoint.discipline === "swim" ? "start" : checkpoint.discipline === "bike" ? "bikeS" : "runS";
    const ms = splitBetween(athlete, from, latest);
    const pace = ms === null ? null : paceMinPerKm(ms, checkpoint.km);
    if (pace !== null) vector.set(`partial:${latest}`, pace);
  }

  return vector;
}

/** The same features, read off a past finisher at the same checkpoint. */
function trainingVector(
  row: TrainingRow,
  course: DivisionCourse,
  latest: string,
  keys: readonly string[],
): Map<string, number> | null {
  const vector = new Map<string, number>();

  for (const key of keys) {
    if (key.startsWith("partial:")) {
      const checkpointId = key.slice("partial:".length);
      const checkpoint = course.checkpoints.find((c) => c.id === checkpointId);
      const elapsed = row.elapsed[checkpointId];
      if (!checkpoint || elapsed === undefined) return null;
      const from =
        checkpoint.discipline === "swim" ? 0 : row.elapsed[checkpoint.discipline === "bike" ? "bikeS" : "runS"];
      if (from === undefined) return null;
      const pace = paceMinPerKm(elapsed - from, checkpoint.km);
      if (pace === null) return null;
      vector.set(key, pace);
      continue;
    }

    if (key.startsWith("percentile:")) {
      const discipline = key.slice("percentile:".length) as Discipline;
      const value = row.percentile[discipline];
      if (value === undefined) return null;
      vector.set(key, value);
      continue;
    }

    const pace = row.pace[key as Discipline];
    if (pace === undefined) return null;
    vector.set(key, pace);
  }

  return vector;
}

interface Standardizer {
  readonly mean: Map<string, number>;
  readonly sd: Map<string, number>;
}

function standardizer(vectors: readonly Map<string, number>[], keys: readonly string[]): Standardizer {
  const mean = new Map<string, number>();
  const sd = new Map<string, number>();

  for (const key of keys) {
    const values = vectors.map((v) => v.get(key) as number);
    const m = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
    mean.set(key, m);
    sd.set(key, Math.sqrt(variance) || 1);
  }

  return { mean, sd };
}

function distance(
  a: Map<string, number>,
  b: Map<string, number>,
  keys: readonly string[],
  scale: Standardizer,
): number {
  let sum = 0;
  for (const key of keys) {
    const mean = scale.mean.get(key) as number;
    const sd = scale.sd.get(key) as number;
    const left = ((a.get(key) as number) - mean) / sd;
    const right = ((b.get(key) as number) - mean) / sd;
    sum += (left - right) ** 2;
  }
  return Math.sqrt(sum);
}

/** Distance-over-current-speed fallback, used before any neighbour exists. */
function extrapolate(
  athlete: Athlete,
  course: DivisionCourse,
  latest: string | null,
  model: NeighbourModel,
): number | null {
  const division = athlete.division;
  const medians = model.medianSpeedKmh[division];
  const checkpoint = latest === null ? null : course.checkpoints.find((c) => c.id === latest);

  let remainingMs = 0;
  const order: Discipline[] = ["swim", "bike", "run"];
  const currentIndex = checkpoint
    ? order.indexOf(checkpoint.discipline === "transition" ? "bike" : checkpoint.discipline)
    : 0;

  for (let i = currentIndex; i < order.length; i += 1) {
    const discipline = order[i] as Discipline;
    const totalKm = disciplineKm(discipline, course);
    const doneKm = i === currentIndex && checkpoint ? checkpoint.km : 0;
    const speed = medians[discipline];
    if (speed === undefined || speed <= 0) return null;
    remainingMs += ((totalKm - doneKm) / speed) * 3_600_000;
  }

  const elapsed = latest === null ? 0 : (athlete.passes[latest] as number) - athlete.startAt;
  return elapsed + remainingMs;
}

function ownSegmentSpeed(athlete: Athlete, course: DivisionCourse, latest: string): number | null {
  const index = checkpointIndex(course, latest);
  const checkpoint = course.checkpoints[index];
  const previous = course.checkpoints[index - 1];
  if (!checkpoint || !previous) return null;
  const ms = splitBetween(athlete, previous.id, checkpoint.id);
  const km = checkpoint.discipline === previous.discipline ? checkpoint.km - previous.km : checkpoint.km;
  if (ms === null || ms <= 0 || km <= 0) return null;
  return km / (ms / 3_600_000);
}

const NOTES: Record<string, string> = {
  sumiyoshi:
    "住吉からランSまではコースの後半で、向かい風と暑さの影響が出やすい区間です。近傍より速い人は幅の早い側を見てください。",
  runS: "ランに入ると予想は安定します。ここから先の誤差は主にペース低下の大きさで決まります。",
  swimF: "バイクがまだ始まっていないため、予想の幅は大きく出ます。",
};

/**
 * Predict the finish from past races: find the finishers whose pace pattern
 * at the same checkpoint most resembles this athlete, and add the median of
 * what they had left to run. Falls back to a plain extrapolation when the
 * neighbour set is too thin to mean anything.
 */
export function predictFinish(
  athlete: Athlete,
  course: DivisionCourse,
  pop: Populations,
  model: NeighbourModel,
  nowMs: number,
  backtest?: BacktestTable,
): Prediction | null {
  const status = athleteStatus(athlete, course, nowMs);
  if (status === "not_started" || status === "dns_suspected") return null;
  if (status === "finished") return null;

  const latest = latestCheckpoint(athlete, course);
  if (latest === null) return null;

  const label = course.checkpoints.find((c) => c.id === latest)?.label ?? latest;
  const elapsed = (athlete.passes[latest] as number) - athlete.startAt;
  const extrapolationMs = extrapolate(athlete, course, latest, model);

  const comparable = new Set(model.features[athlete.division]);
  const own = featureVector(athlete, course, latest, model.features[athlete.division], (d) =>
    comparable.has(d),
  );

  // Disciplines whose distance changed between years enter as a within-year
  // percentile rather than an absolute pace, so the scales stay comparable.
  for (const discipline of model.percentileFeatures[athlete.division]) {
    const value = livePercentile(athlete, discipline, course, pop);
    if (value !== null) own.set(`percentile:${discipline}`, value);
  }

  const keys = [...own.keys()];

  const candidates: { row: TrainingRow; vector: Map<string, number>; remaining: number }[] = [];
  if (keys.length > 0) {
    for (const row of model.rows[athlete.division]) {
      const atCheckpoint = row.elapsed[latest];
      if (atCheckpoint === undefined) continue;
      const vector = trainingVector(row, course, latest, keys);
      if (!vector) continue;
      candidates.push({ row, vector, remaining: row.totalMs - atCheckpoint });
    }
  }

  if (candidates.length >= MIN_NEIGHBOURS) {
    const scale = standardizer([own, ...candidates.map((c) => c.vector)], keys);
    const nearest = candidates
      .map((c) => ({ ...c, d: distance(own, c.vector, keys, scale) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, NEIGHBOUR_COUNT);

    const remaining = nearest.map((n) => n.remaining).sort((a, b) => a - b);
    const yearBreakdown: Record<number, number> = {};
    for (const n of nearest) yearBreakdown[n.row.year] = (yearBreakdown[n.row.year] ?? 0) + 1;

    const medianRemaining = percentile(remaining, 0.5);
    const accuracy = backtest?.get(`${athlete.division}:${latest}`);
    const neighbourSpeeds = nearest
      .map((n) => {
        const index = checkpointIndex(course, latest);
        const previous = course.checkpoints[index - 1];
        const checkpoint = course.checkpoints[index];
        if (!previous || !checkpoint) return null;
        const from = n.row.elapsed[previous.id];
        const to = n.row.elapsed[latest];
        if (from === undefined || to === undefined || to <= from) return null;
        const km = checkpoint.discipline === previous.discipline ? checkpoint.km - previous.km : checkpoint.km;
        return km / ((to - from) / 3_600_000);
      })
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);

    return {
      method: "neighbours",
      atCheckpoint: latest,
      atCheckpointLabel: label,
      finishAt: athlete.startAt + elapsed + medianRemaining,
      totalMs: elapsed + medianRemaining,
      rangeLowMs: elapsed + percentile(remaining, 0.25),
      rangeHighMs: elapsed + percentile(remaining, 0.75),
      explanation: {
        neighbourCount: nearest.length,
        yearBreakdown,
        remainingP25Ms: percentile(remaining, 0.25),
        remainingMedianMs: medianRemaining,
        remainingP75Ms: percentile(remaining, 0.75),
        ownSpeedKmh: ownSegmentSpeed(athlete, course, latest),
        neighbourSpeedKmh: neighbourSpeeds.length > 0 ? percentile(neighbourSpeeds, 0.5) : null,
        extrapolationMs,
        backtestMedianErrorMs: accuracy?.medianErrorMs ?? null,
        backtestWithin25MinPct: accuracy?.within25MinPct ?? null,
        note: NOTES[latest] ?? "計測点を通過するたびに予想は更新されます。",
      },
    };
  }

  if (extrapolationMs === null) return null;

  return {
    method: "extrapolation",
    atCheckpoint: latest,
    atCheckpointLabel: label,
    finishAt: athlete.startAt + extrapolationMs,
    totalMs: extrapolationMs,
    rangeLowMs: extrapolationMs * 0.93,
    rangeHighMs: extrapolationMs * 1.07,
    explanation: {
      neighbourCount: candidates.length,
      yearBreakdown: {},
      remainingP25Ms: 0,
      remainingMedianMs: extrapolationMs - elapsed,
      remainingP75Ms: 0,
      ownSpeedKmh: ownSegmentSpeed(athlete, course, latest),
      neighbourSpeedKmh: null,
      extrapolationMs,
      backtestMedianErrorMs: null,
      backtestWithin25MinPct: null,
      note: "過去データで似た選手が足りないため、残り距離を部門の平均ペースで割った概算です。",
    },
  };
}
