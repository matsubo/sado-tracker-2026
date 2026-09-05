import type { Discipline, Division, DivisionCourse, RaceConfig } from "@/config/races";
import type { Athlete, RaceSnapshot } from "@/lib/domain/types";
import type { NeighbourModel } from "@/lib/history/model";
import type { NameIndex, PastResult } from "@/lib/history/nameIndex";
import { findPastResults } from "@/lib/history/nameIndex";
import { deviationScore } from "./deviation";
import { disciplineKm, disciplineStart, elapsedAt, splitBetween } from "./elapsed";
import { buildPopulations, latestCheckpoint, type Populations } from "./population";
import { estimatePosition, fieldOrder, type PositionEstimate } from "./position";
import {
  type BacktestTable,
  type CandidateCache,
  createCandidateCache,
  type Prediction,
  predictFinish,
} from "./prediction";
import {
  cumulativeRanks,
  disciplineRanks,
  type Rank,
  type RankHistoryEntry,
  type RankSet,
  ranksAtCheckpoint,
  splitRank,
} from "./ranking";
import { athleteStatus, type Status } from "./status";

const DIVISIONS: readonly Division[] = ["A", "B", "RA", "RB"];
const ALL_DISCIPLINES: readonly Discipline[] = ["swim", "bike", "run"];

const DISCIPLINE_LABELS: Record<Discipline, string> = {
  swim: "スイム",
  bike: "バイク",
  run: "ラン",
};

export interface ComputedDiscipline {
  readonly discipline: Discipline;
  readonly label: string;
  readonly km: number;
  readonly timeMs: number | null;
  readonly provisional: boolean;
  readonly atCheckpointLabel: string | null;
  readonly ranks: RankSet;
  readonly deviation: number | null;
  readonly speedKmh: number | null;
}

export interface ComputedSplit {
  readonly checkpointId: string;
  readonly label: string;
  readonly discipline: Discipline | "transition";
  readonly km: number;
  readonly kmInferred: boolean;
  readonly passedAt: number;
  readonly elapsedMs: number;
  readonly segmentMs: number | null;
  readonly segmentKm: number | null;
  readonly segmentSpeedKmh: number | null;
  readonly segmentRank: Rank | null;
  readonly cumulativeRanks: RankSet;
}

export interface ComputedAthlete {
  readonly athlete: Athlete;
  readonly status: Status;
  readonly lastCheckpointId: string | null;
  readonly lastCheckpointLabel: string | null;
  readonly lastPassedAt: number | null;
  readonly elapsedMs: number | null;
  readonly totalRanks: RankSet;
  readonly disciplines: readonly ComputedDiscipline[];
  readonly position: PositionEstimate;
  readonly prediction: Prediction | null;
  readonly splits: readonly ComputedSplit[];
  readonly rankHistory: readonly RankHistoryEntry[];
  readonly pastResults: readonly PastResult[];
  readonly fieldOrder: number;
}

export interface ComputedSnapshot {
  readonly year: number;
  readonly fetchedAt: number;
  readonly computedAt: number;
  readonly stale: boolean;
  readonly replay: boolean;
  /** Milliseconds between refreshes, so clients can match the cadence. */
  readonly pollIntervalMs: number;
  readonly config: RaceConfig;
  readonly athletes: ReadonlyMap<string, ComputedAthlete>;
  readonly byDivision: Readonly<Record<Division, readonly string[]>>;
  readonly counts: Readonly<Record<Division, Readonly<Record<string, number>>>>;
  readonly populations: Readonly<Record<Division, Populations>>;
}

function computeDisciplines(
  athlete: Athlete,
  course: DivisionCourse,
  pop: Populations,
): ComputedDiscipline[] {
  return ALL_DISCIPLINES.map((discipline) => {
    const result = disciplineRanks(athlete, discipline, pop, course);
    const km = disciplineKm(discipline, course);
    const from = disciplineStart(discipline);
    const measuredAt = result.atCheckpoint;

    const peers =
      measuredAt === null
        ? []
        : pop
            .atCheckpoint(measuredAt)
            .map((other) => splitBetween(other, from, measuredAt))
            .filter((value): value is number => value !== null);

    const partialKm =
      measuredAt === null ? km : (course.checkpoints.find((c) => c.id === measuredAt)?.km ?? km);

    return {
      discipline,
      label: DISCIPLINE_LABELS[discipline],
      km,
      timeMs: result.timeMs,
      provisional: result.provisional,
      atCheckpointLabel:
        result.provisional && measuredAt
          ? (course.checkpoints.find((c) => c.id === measuredAt)?.label ?? null)
          : null,
      ranks: result.ranks,
      deviation: result.timeMs === null ? null : deviationScore(peers, result.timeMs),
      speedKmh:
        discipline === "bike" && result.timeMs !== null && result.timeMs > 0
          ? (result.provisional ? partialKm : km) / (result.timeMs / 3_600_000)
          : null,
    };
  });
}

function computeSplits(
  athlete: Athlete,
  course: DivisionCourse,
  pop: Populations,
): ComputedSplit[] {
  const splits: ComputedSplit[] = [];
  let previousId: string | null = null;
  let previousKm = 0;
  let previousDiscipline: Discipline | "transition" | null = null;

  for (const checkpoint of course.checkpoints) {
    if (checkpoint.id === "start") continue;
    const passedAt = athlete.passes[checkpoint.id];
    if (passedAt === undefined) continue;

    const segmentMs = previousId === null ? null : splitBetween(athlete, previousId, checkpoint.id);
    const sameLeg = previousDiscipline === checkpoint.discipline;
    const segmentKm =
      previousId === null ? checkpoint.km : sameLeg ? checkpoint.km - previousKm : checkpoint.km;

    splits.push({
      checkpointId: checkpoint.id,
      label: checkpoint.label,
      discipline: checkpoint.discipline,
      km: checkpoint.km,
      kmInferred: checkpoint.inferred === true,
      passedAt,
      elapsedMs: passedAt - athlete.startAt,
      segmentMs,
      segmentKm: segmentKm > 0 ? segmentKm : null,
      segmentSpeedKmh:
        segmentMs !== null && segmentMs > 0 && segmentKm > 0
          ? segmentKm / (segmentMs / 3_600_000)
          : null,
      segmentRank: previousId === null ? null : splitRank(athlete, previousId, checkpoint.id, pop),
      cumulativeRanks: ranksAtCheckpoint(athlete, checkpoint.id, pop),
    });

    previousId = checkpoint.id;
    previousKm = checkpoint.km;
    previousDiscipline = checkpoint.discipline;
  }

  return splits;
}

/**
 * Compute everything the API serves, once per poll. Ranking is O(n) per
 * athlete per checkpoint, which for 1,900 athletes stays well inside the
 * one-minute poll interval.
 */
export function computeSnapshot(
  snapshot: RaceSnapshot,
  config: RaceConfig,
  model: NeighbourModel,
  nameIndex: NameIndex,
  nowMs: number,
  options: {
    stale?: boolean;
    replay?: boolean;
    backtest?: BacktestTable;
    pollIntervalMs?: number;
  } = {},
): ComputedSnapshot {
  const athletes = new Map<string, ComputedAthlete>();
  // Athletes standing at the same timing point share one candidate set.
  const candidateCache: CandidateCache = createCandidateCache();
  const byDivision: Record<Division, string[]> = { A: [], B: [], RA: [], RB: [] };
  const counts: Record<Division, Record<string, number>> = { A: {}, B: {}, RA: {}, RB: {} };
  const populations: Record<Division, Populations> = {} as Record<Division, Populations>;

  for (const division of DIVISIONS) {
    const course = config.divisions[division];
    const pop = buildPopulations(snapshot.athletes, division, course, nowMs);
    populations[division] = pop;

    for (const checkpoint of course.checkpoints) {
      if (checkpoint.id === "start") continue;
      counts[division][checkpoint.id] = pop.atCheckpoint(checkpoint.id).length;
    }

    const order = fieldOrder(pop.all, course, nowMs);
    const orderIndex = new Map(order.map((bib, index) => [bib, index]));
    byDivision[division] = order;

    const divisionAthletes = snapshot.athletes.filter((a) => a.division === division);
    for (const athlete of divisionAthletes) {
      const status = athleteStatus(athlete, course, nowMs);
      const lastCheckpointId = latestCheckpoint(athlete, course);
      const lastCheckpoint = lastCheckpointId
        ? course.checkpoints.find((c) => c.id === lastCheckpointId)
        : undefined;

      athletes.set(athlete.bib, {
        athlete,
        status,
        lastCheckpointId,
        lastCheckpointLabel: lastCheckpoint?.label ?? null,
        lastPassedAt: lastCheckpointId ? (athlete.passes[lastCheckpointId] as number) : null,
        elapsedMs: lastCheckpointId ? elapsedAt(athlete, lastCheckpointId) : null,
        totalRanks: lastCheckpointId
          ? ranksAtCheckpoint(athlete, lastCheckpointId, pop)
          : { division: null, sex: null, ageGroup: null },
        disciplines: computeDisciplines(athlete, course, pop),
        position: estimatePosition(athlete, course, pop, nowMs, model.medianSpeedKmh[division]),
        prediction: predictFinish(
          athlete,
          course,
          pop,
          model,
          nowMs,
          options.backtest,
          candidateCache,
        ),
        splits: computeSplits(athlete, course, pop),
        rankHistory: cumulativeRanks(athlete, pop, course),
        pastResults: findPastResults(nameIndex, athlete.nameKey),
        fieldOrder: orderIndex.get(athlete.bib) ?? Number.MAX_SAFE_INTEGER,
      });
    }
  }

  return {
    year: snapshot.year,
    fetchedAt: snapshot.fetchedAt,
    computedAt: nowMs,
    stale: options.stale === true,
    replay: options.replay === true,
    pollIntervalMs: options.pollIntervalMs ?? 60_000,
    config,
    athletes,
    byDivision,
    counts,
    populations,
  };
}
