/** The four scored divisions. Relay divisions (RA, RB) have no sex or age group. */
export type Division = "A" | "B" | "RA" | "RB";

export type Discipline = "swim" | "bike" | "run";

/** A timing point on the course, or a transition marker between disciplines. */
export interface CheckpointDef {
  /** Stable identifier used in URLs, APIs and the client. */
  readonly id: string;
  /** Japanese label shown in the UI. */
  readonly label: string;
  /** Every spelling this column has had in a CSV header, across years. */
  readonly csvHeaders: readonly string[];
  readonly discipline: Discipline | "transition";
  /** Kilometres completed within `discipline` when this point is reached. */
  readonly km: number;
  /** True when `km` is inferred from split ratios rather than published. */
  readonly inferred?: boolean;
}

export interface DivisionCourse {
  readonly swimKm: number;
  readonly bikeKm: number;
  readonly runKm: number;
  /** Wave start as "HH:MM" in Asia/Tokyo. */
  readonly waveStart: string;
  /** Minutes after the wave start before a silent athlete counts as not started. */
  readonly swimCutoffMin: number;
  /** False when the swim was shortened, so its pace is not comparable across years. */
  readonly swimTimesComparable: boolean;
  /** Ordered from the start to the finish. */
  readonly checkpoints: readonly CheckpointDef[];
}

export interface RaceConfig {
  readonly year: number;
  readonly csvUrl: string;
  /** Race date as "YYYY-MM-DD" in Asia/Tokyo. */
  readonly raceDate: string;
  readonly divisions: Readonly<Record<Division, DivisionCourse>>;
  /** Raw 部門 label to division, or null when the row must be dropped. */
  readonly divisionAliases: Readonly<Record<string, Division | null>>;
  /** Header spellings of the athlete name column. */
  readonly nameHeaders: readonly string[];
  /** Header spellings of the official total time column, if the year has one. */
  readonly totalHeaders: readonly string[];
  /** False when the checkpoint layout differs too much to train predictions on. */
  readonly usableForPrediction: boolean;
}
