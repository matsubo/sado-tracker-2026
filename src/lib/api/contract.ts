/**
 * The wire contract between the API routes and the client, as strict zod
 * schemas. The types the client imports are inferred from these, and the
 * integration suite parses every body a route can send against them, so a
 * field added to an internal type cannot reach a client until the contract
 * says so, and a field the contract promises cannot be left out.
 */
import { z } from "zod";
import { DISCIPLINES, DIVISIONS } from "@/config/races";
import { STATUSES } from "@/lib/compute/status";
import { RANKING_DISCIPLINES } from "@/lib/compute/tables";

const LinkSchema = z.strictObject({ href: z.string() }).readonly();

/** HAL links: every resource carries at least `self`. */
const LinksSchema = z.object({ self: LinkSchema }).catchall(LinkSchema).readonly();
export type Links = z.infer<typeof LinksSchema>;

const DivisionSchema = z.enum(DIVISIONS);
const DisciplineSchema = z.enum(DISCIPLINES);
const StatusSchema = z.enum(STATUSES);

const RankSchema = z
  .strictObject({
    rank: z.number().int().positive(),
    /** Size of the population the rank was taken against. */
    of: z.number().int().nonnegative(),
  })
  .readonly();
export type RankDto = z.infer<typeof RankSchema>;

const RankSetSchema = z
  .strictObject({
    division: RankSchema.nullable(),
    sex: RankSchema.nullable(),
    ageGroup: RankSchema.nullable(),
  })
  .readonly();
export type RankSetDto = z.infer<typeof RankSetSchema>;

const DisciplineDtoSchema = z
  .strictObject({
    discipline: DisciplineSchema,
    label: z.string(),
    km: z.number(),
    timeMs: z.number().nullable(),
    /** True while the discipline is still in progress. */
    provisional: z.boolean(),
    /**
     * Distance the time covers. For a leg still being raced this is the
     * checkpoint reached, not the whole leg: 21 minutes is a sensible run
     * split and a nonsensical half marathon, and only this number says which
     * of the two is on screen.
     */
    measuredKm: z.number(),
    atCheckpointLabel: z.string().nullable(),
    ranks: RankSetSchema,
    /** Speed in km/h for bike, null for swim and run which use pace. */
    speedKmh: z.number().nullable(),
  })
  .readonly();
export type DisciplineDto = z.infer<typeof DisciplineDtoSchema>;

const SplitSchema = z
  .strictObject({
    checkpointId: z.string(),
    label: z.string(),
    discipline: z.enum([...DISCIPLINES, "transition"]),
    km: z.number(),
    kmInferred: z.boolean(),
    passedAt: z.number(),
    elapsedMs: z.number(),
    /** Time since the previous checkpoint. */
    segmentMs: z.number().nullable(),
    segmentKm: z.number().nullable(),
    segmentSpeedKmh: z.number().nullable(),
    /** Kept for callers that only ever read the whole-type segment rank. */
    segmentRank: RankSchema.nullable(),
    /** The same segment ranked against the type, the sex and the age group. */
    segmentRanks: RankSetSchema,
    cumulativeRanks: RankSetSchema,
  })
  .readonly();
export type SplitDto = z.infer<typeof SplitSchema>;

const PositionSchema = z
  .strictObject({
    discipline: DisciplineSchema,
    lastCheckpointLabel: z.string().nullable(),
    lastKm: z.number(),
    lastAt: z.number(),
    speedKmh: z.number(),
    capKm: z.number(),
    estKm: z.number(),
    totalKm: z.number(),
    waiting: z.boolean(),
    inTransition: z.boolean(),
    source: z.enum(["own", "live-median", "history-median", "none"]),
  })
  .readonly();
export type PositionDto = z.infer<typeof PositionSchema>;

const PredictionSchema = z
  .strictObject({
    method: z.enum(["neighbours", "extrapolation"]),
    atCheckpointLabel: z.string(),
    finishAt: z.number(),
    totalMs: z.number(),
    rangeLowMs: z.number(),
    rangeHighMs: z.number(),
    explanation: z
      .strictObject({
        neighbourCount: z.number().int().nonnegative(),
        yearBreakdown: z.record(z.string(), z.number()).readonly(),
        remainingP25Ms: z.number(),
        remainingMedianMs: z.number(),
        remainingP75Ms: z.number(),
        ownSpeedKmh: z.number().nullable(),
        neighbourSpeedKmh: z.number().nullable(),
        extrapolationMs: z.number().nullable(),
        backtestMedianErrorMs: z.number().nullable(),
        backtestWithin25MinPct: z.number().nullable(),
        note: z.string(),
      })
      .readonly(),
  })
  .readonly();
export type PredictionDto = z.infer<typeof PredictionSchema>;

const PastDisciplineSchema = z
  .strictObject({
    discipline: DisciplineSchema,
    label: z.string(),
    timeMs: z.number(),
    /** Distance raced that year; the course has not always been the same. */
    km: z.number(),
    paceText: z.string(),
    divisionRank: RankSchema.nullable(),
    ageRank: RankSchema.nullable(),
  })
  .readonly();

const PastResultSchema = z
  .strictObject({
    year: z.number().int(),
    division: DivisionSchema,
    totalText: z.string(),
    totalMs: z.number(),
    divisionRank: RankSchema,
    ageRank: RankSchema.nullable(),
    ageGroupId: z.string().nullable(),
    disciplines: z.array(PastDisciplineSchema).readonly(),
  })
  .readonly();
export type PastResultDto = z.infer<typeof PastResultSchema>;

const athleteSummaryShape = {
  bib: z.string(),
  name: z.string(),
  division: DivisionSchema,
  ageGroupId: z.string().nullable(),
  ageGroupLabel: z.string().nullable(),
  sex: z.enum(["M", "F"]).nullable(),
  status: StatusSchema,
  startAt: z.number(),
  lastCheckpointLabel: z.string().nullable(),
  lastPassedAt: z.number().nullable(),
  elapsedMs: z.number().nullable(),
  totalRanks: RankSetSchema,
  disciplines: z.array(DisciplineDtoSchema).readonly(),
  position: PositionSchema,
  prediction: PredictionSchema.nullable(),
  officialTotal: z.string().nullable(),
  remark: z.string(),
  _links: LinksSchema,
};

/** The shape used by friend cards and search results. */
const AthleteSummarySchema = z.strictObject(athleteSummaryShape).readonly();
export type AthleteSummaryDto = z.infer<typeof AthleteSummarySchema>;

const MapEntrySchema = z
  .strictObject({
    bib: z.string(),
    name: z.string(),
    ageGroupId: z.string().nullable(),
    status: StatusSchema,
    fieldOrder: z.number().int().nonnegative(),
    divisionRank: RankSchema.nullable(),
    position: PositionSchema,
    isSelf: z.boolean().optional(),
    _links: LinksSchema,
  })
  .readonly();
export type MapEntryDto = z.infer<typeof MapEntrySchema>;

export const AthleteDetailSchema = z
  .strictObject({
    ...athleteSummaryShape,
    splits: z.array(SplitSchema).readonly(),
    rankHistory: z
      .array(
        z
          .strictObject({
            checkpointId: z.string(),
            label: z.string(),
            ranks: RankSetSchema,
          })
          .readonly(),
      )
      .readonly(),
    pastResults: z.array(PastResultSchema).readonly(),
    /** Who is just ahead of and just behind this athlete on the course. */
    neighbours: z
      .strictObject({
        /** Their own age group, which is who they are racing. Null for a relay. */
        ageGroup: z.array(MapEntrySchema).readonly().nullable(),
        /** Anyone in the type, which answers "how far off the front are they". */
        overall: z.array(MapEntrySchema).readonly(),
      })
      .readonly(),
  })
  .readonly();
export type AthleteDetailDto = z.infer<typeof AthleteDetailSchema>;

/** A timing point as the race endpoint publishes it. */
const CheckpointSchema = z
  .strictObject({
    id: z.string(),
    label: z.string(),
    km: z.number(),
    discipline: z.string(),
  })
  .readonly();
export type CheckpointDto = z.infer<typeof CheckpointSchema>;

export const RaceStateSchema = z
  .strictObject({
    year: z.number().int(),
    fetchedAt: z.number(),
    /**
     * The server's current time. Clients project positions against this
     * rather than their own clock, so device skew and replay mode both stay
     * correct.
     */
    now: z.number(),
    stale: z.boolean(),
    replay: z.boolean(),
    /** How often the server recomputes, so the client never polls slower. */
    pollIntervalMs: z.number().positive(),
    /**
     * True once the race is over and the file cannot change again. The page
     * then stops presenting itself as live: no clock, no countdown, no polling.
     */
    finalResults: z.boolean(),
    /** The day the race was held, "YYYY-MM-DD". */
    raceDate: z.string(),
    /** Past races the prediction model was trained on; empty means none loaded. */
    historyYears: z.array(z.number().int()).readonly(),
    /** Counts of athletes measured at each checkpoint, per division. */
    counts: z.record(DivisionSchema, z.record(z.string(), z.number()).readonly()).readonly(),
    divisions: z
      .array(
        z
          .strictObject({
            id: DivisionSchema,
            label: z.string(),
            /** Everyone entered in the division. */
            entrants: z.number().int().nonnegative(),
            /** Those currently counted in rankings: racing, finished or retired. */
            racing: z.number().int().nonnegative(),
            /** When this wave goes off, "HH:MM" in JST. The organiser can move it. */
            waveStart: z.string(),
            /** The swim distance actually being swum, which the organiser can shorten. */
            swimKm: z.number(),
            checkpoints: z.array(CheckpointSchema).readonly(),
          })
          .readonly(),
      )
      .readonly(),
    _links: LinksSchema,
  })
  .readonly();
export type RaceStateDto = z.infer<typeof RaceStateSchema>;

const RankingRowSchema = z
  .strictObject({
    rank: z.number().int().positive(),
    bib: z.string(),
    name: z.string(),
    ageGroupId: z.string().nullable(),
    timeMs: z.number(),
    paceText: z.string(),
    diffMs: z.number().nullable(),
    isTarget: z.boolean(),
    _links: LinksSchema,
  })
  .readonly();
export type RankingRowDto = z.infer<typeof RankingRowSchema>;

export const RankingPageSchema = z
  .strictObject({
    division: DivisionSchema,
    discipline: z.enum(RANKING_DISCIPLINES),
    ageGroupId: z.string().nullable(),
    measuredAt: z.string(),
    /** What the 差 column is measured from. */
    diffBasis: z
      .strictObject({
        kind: z.enum(["leader", "athlete"]),
        /** Name of the athlete the differences are relative to. */
        name: z.string(),
      })
      .readonly()
      .nullable(),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    perPage: z.number().int().positive(),
    rows: z.array(RankingRowSchema).readonly(),
    /** Set when a target bib is not in this table yet. */
    targetElsewhere: z
      .strictObject({
        bib: z.string(),
        name: z.string(),
        message: z.string(),
      })
      .readonly()
      .nullable(),
    _links: LinksSchema,
  })
  .readonly();
export type RankingPageDto = z.infer<typeof RankingPageSchema>;

export const LeaderboardSchema = z
  .strictObject({
    division: DivisionSchema,
    label: z.string(),
    /** How the rows are ordered: by progress once anyone is measured, else by bib. */
    order: z.enum(["field", "bib"]),
    /** Everyone entered in the division. */
    entrants: z.number().int().nonnegative(),
    /** Athletes currently counted: racing, finished or retired. */
    racing: z.number().int().nonnegative(),
    finished: z.number().int().nonnegative(),
    /**
     * How many rows the reader is paging through: the whole field, or the
     * matches when a filter is set.
     */
    total: z.number().int().nonnegative(),
    /** The filter in force, normalised; empty when the whole field is shown. */
    query: z.string(),
    page: z.number().int().positive(),
    perPage: z.number().int().positive(),
    leaders: z
      .array(
        z
          .strictObject({
            place: z.number().int().positive(),
            athlete: AthleteSummarySchema,
          })
          .readonly(),
      )
      .readonly(),
    _links: LinksSchema,
  })
  .readonly();
export type LeaderboardDto = z.infer<typeof LeaderboardSchema>;

/** Search results, or the current state of a list of bibs. */
export const AthletesResponseSchema = z
  .strictObject({
    count: z.number().int().nonnegative(),
    athletes: z.array(AthleteSummarySchema).readonly(),
    /** Bibs asked for that are not in this year's entry list. */
    missing: z.array(z.string()).readonly(),
    _links: LinksSchema,
  })
  .readonly();
export type AthletesResponseDto = z.infer<typeof AthletesResponseSchema>;

/** One checkpoint pass by a bookmarked athlete, for the notification list. */
const PassEventSchema = z
  .strictObject({
    /** Stable per bib and checkpoint, so the client can remember what it showed. */
    key: z.string(),
    bib: z.string(),
    name: z.string(),
    checkpointId: z.string(),
    checkpointLabel: z.string(),
    discipline: z.string(),
    passedAt: z.number(),
    elapsedMs: z.number(),
    divisionRank: RankSchema.nullable(),
    ageRank: RankSchema.nullable(),
    segmentMs: z.number().nullable(),
    segmentSpeedKmh: z.number().nullable(),
    _links: LinksSchema,
  })
  .readonly();
export type PassEventDto = z.infer<typeof PassEventSchema>;

/**
 * Every checkpoint the asked-for athletes have passed, newest first. The
 * client decides which are unread by key, so a checkpoint the timing site
 * publishes late still surfaces rather than being missed by a timestamp.
 */
export const EventsResponseSchema = z
  .strictObject({
    count: z.number().int().nonnegative(),
    events: z.array(PassEventSchema).readonly(),
    _links: LinksSchema,
  })
  .readonly();
export type EventsResponseDto = z.infer<typeof EventsResponseSchema>;

export const MapResponseSchema = z
  .strictObject({
    division: DivisionSchema,
    ageGroupId: z.string().nullable(),
    /** Server time the snapshot was taken; not the browser's clock in replay. */
    fetchedAt: z.number(),
    count: z.number().int().nonnegative(),
    entries: z.array(MapEntrySchema).readonly(),
    _links: LinksSchema,
  })
  .readonly();
export type MapResponseDto = z.infer<typeof MapResponseSchema>;
