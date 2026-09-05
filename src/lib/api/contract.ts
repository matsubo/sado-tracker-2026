/**
 * The wire contract between the API routes and the client. Kept in one file
 * so pages and route handlers cannot drift apart.
 */
import type { Discipline, Division } from "@/config/races";
import type { Status } from "@/lib/compute/status";

/** HAL links: every resource carries at least `self`. */
export interface Links {
  readonly self: { href: string };
  readonly [rel: string]: { href: string } | undefined;
}

export interface RankDto {
  readonly rank: number;
  /** Size of the population the rank was taken against. */
  readonly of: number;
}

export interface RankSetDto {
  readonly division: RankDto | null;
  readonly sex: RankDto | null;
  readonly ageGroup: RankDto | null;
}

export interface DisciplineDto {
  readonly discipline: Discipline;
  readonly label: string;
  readonly km: number;
  readonly timeMs: number | null;
  /** True while the discipline is still in progress. */
  readonly provisional: boolean;
  readonly atCheckpointLabel: string | null;
  readonly ranks: RankSetDto;
  /** Speed in km/h for bike, null for swim and run which use pace. */
  readonly speedKmh: number | null;
}

export interface SplitDto {
  readonly checkpointId: string;
  readonly label: string;
  readonly discipline: Discipline | "transition";
  readonly km: number;
  readonly kmInferred: boolean;
  readonly passedAt: number;
  readonly elapsedMs: number;
  /** Time since the previous checkpoint. */
  readonly segmentMs: number | null;
  readonly segmentKm: number | null;
  readonly segmentSpeedKmh: number | null;
  readonly segmentRank: RankDto | null;
  readonly cumulativeRanks: RankSetDto;
}

export interface PositionDto {
  readonly discipline: Discipline;
  readonly lastCheckpointLabel: string | null;
  readonly lastKm: number;
  readonly lastAt: number;
  readonly speedKmh: number;
  readonly capKm: number;
  readonly estKm: number;
  readonly totalKm: number;
  readonly waiting: boolean;
  readonly inTransition: boolean;
  readonly source: "own" | "live-median" | "history-median" | "none";
}

export interface PredictionDto {
  readonly method: "neighbours" | "extrapolation";
  readonly atCheckpointLabel: string;
  readonly finishAt: number;
  readonly totalMs: number;
  readonly rangeLowMs: number;
  readonly rangeHighMs: number;
  readonly explanation: {
    readonly neighbourCount: number;
    readonly yearBreakdown: Readonly<Record<string, number>>;
    readonly remainingP25Ms: number;
    readonly remainingMedianMs: number;
    readonly remainingP75Ms: number;
    readonly ownSpeedKmh: number | null;
    readonly neighbourSpeedKmh: number | null;
    readonly extrapolationMs: number | null;
    readonly backtestMedianErrorMs: number | null;
    readonly backtestWithin25MinPct: number | null;
    readonly note: string;
  };
}

export interface PastResultDto {
  readonly year: number;
  readonly division: Division;
  readonly totalText: string;
  readonly divisionRank: RankDto;
  readonly ageRank: RankDto | null;
  readonly ageGroupId: string | null;
}

/** The shape used by friend cards and search results. */
export interface AthleteSummaryDto {
  readonly bib: string;
  readonly name: string;
  readonly division: Division;
  readonly ageGroupId: string | null;
  readonly ageGroupLabel: string | null;
  readonly sex: "M" | "F" | null;
  readonly status: Status;
  readonly startAt: number;
  readonly lastCheckpointLabel: string | null;
  readonly lastPassedAt: number | null;
  readonly elapsedMs: number | null;
  readonly totalRanks: RankSetDto;
  readonly disciplines: readonly DisciplineDto[];
  readonly position: PositionDto;
  readonly prediction: PredictionDto | null;
  readonly officialTotal: string | null;
  readonly remark: string;
  readonly _links: Links;
}

export interface AthleteDetailDto extends AthleteSummaryDto {
  readonly splits: readonly SplitDto[];
  readonly rankHistory: readonly {
    readonly checkpointId: string;
    readonly label: string;
    readonly ranks: RankSetDto;
  }[];
  readonly pastResults: readonly PastResultDto[];
  /** Age-group rivals ahead of and behind this athlete on the course. */
  readonly neighbours: readonly MapEntryDto[];
}

export interface MapEntryDto {
  readonly bib: string;
  readonly name: string;
  readonly ageGroupId: string | null;
  readonly status: Status;
  readonly fieldOrder: number;
  readonly divisionRank: RankDto | null;
  readonly position: PositionDto;
  readonly isSelf?: boolean;
}

export interface RaceStateDto {
  readonly year: number;
  readonly fetchedAt: number;
  /**
   * The server's current time. Clients project positions against this rather
   * than their own clock, so device skew and replay mode both stay correct.
   */
  readonly now: number;
  readonly stale: boolean;
  readonly replay: boolean;
  /** How often the server recomputes, so the client never polls slower. */
  readonly pollIntervalMs: number;
  /** Counts of athletes measured at each checkpoint, per division. */
  readonly counts: Readonly<Record<Division, Readonly<Record<string, number>>>>;
  readonly divisions: readonly {
    readonly id: Division;
    readonly label: string;
    /** Everyone entered in the division. */
    readonly entrants: number;
    /** Those currently counted in rankings: racing, finished or retired. */
    readonly racing: number;
    readonly checkpoints: readonly { id: string; label: string; km: number; discipline: string }[];
  }[];
  readonly _links: Links;
}

export interface RankingRowDto {
  readonly rank: number;
  readonly bib: string;
  readonly name: string;
  readonly ageGroupId: string | null;
  readonly timeMs: number;
  readonly paceText: string;
  readonly diffMs: number | null;
  readonly isTarget: boolean;
}

export interface RankingPageDto {
  readonly division: Division;
  readonly discipline: Discipline | "total";
  readonly ageGroupId: string | null;
  readonly measuredAt: string;
  /** What the 差 column is measured from. */
  readonly diffBasis: {
    readonly kind: "leader" | "athlete";
    /** Name of the athlete the differences are relative to. */
    readonly name: string;
  } | null;
  readonly total: number;
  readonly page: number;
  readonly perPage: number;
  readonly rows: readonly RankingRowDto[];
  /** Set when a target bib is not in this table yet. */
  readonly targetElsewhere: {
    readonly bib: string;
    readonly name: string;
    readonly message: string;
  } | null;
  readonly _links: Links;
}
