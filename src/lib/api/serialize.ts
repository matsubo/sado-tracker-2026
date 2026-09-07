import { DISCIPLINE_LABELS, DIVISION_LABELS, DIVISIONS, type Division } from "@/config/races";
import type { Rank, RankSet } from "@/lib/compute/ranking";
import type { ComputedAthlete, ComputedSnapshot } from "@/lib/compute/snapshot";
import { formatBikeSpeed, formatDuration, formatRunPace, formatSwimPace } from "@/lib/format";
import type {
  AthleteDetailDto,
  AthleteSummaryDto,
  DisciplineDto,
  Links,
  MapEntryDto,
  PastResultDto,
  PositionDto,
  PredictionDto,
  RaceStateDto,
  RankDto,
  RankSetDto,
  SplitDto,
} from "./contract";

/**
 * External athlete page on the sibling results site, which keys athletes by
 * name with a single space. Names arrive normalized, but an ideographic space
 * is replaced again here so the link cannot break if that ever changes.
 */
export function aiTriHref(name: string): string {
  const normalized = name.replace(/　/g, " ").replace(/\s+/g, " ").trim();
  return `https://ai-triathlon-result.teraren.com/athletes/${encodeURIComponent(normalized)}`;
}

/** Where a bib can be followed to: the API resource and the page. */
export function athleteRefLinks(bib: string): Links {
  return {
    self: { href: `/api/athletes/${bib}` },
    page: { href: `/athletes/${bib}` },
  };
}

export function leaderboardHref(division: Division): string {
  return `/api/leaderboard?div=${division}`;
}

export function rankingsHref(division: Division): string {
  return `/api/divisions/${division}/rankings`;
}

export function mapHref(division: Division): string {
  return `/api/map?div=${division}`;
}

function athleteLinks(computed: ComputedAthlete): Links {
  const { bib, division, name } = computed.athlete;
  return {
    ...athleteRefLinks(bib),
    division: { href: rankingsHref(division) },
    map: { href: mapHref(division) },
    aiTri: { href: aiTriHref(name) },
  };
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

const toRank = (rank: Rank | null): RankDto | null =>
  rank === null ? null : { rank: rank.rank, of: rank.of };

const toRankSet = (ranks: RankSet): RankSetDto => ({
  division: toRank(ranks.division),
  sex: toRank(ranks.sex),
  ageGroup: toRank(ranks.ageGroup),
});

function toPosition(computed: ComputedAthlete): PositionDto {
  const p = computed.position;
  return {
    discipline: p.discipline,
    lastCheckpointLabel: p.lastCheckpointLabel,
    lastKm: round(p.lastKm, 2),
    lastAt: p.lastAt,
    speedKmh: round(p.speedKmh, 2),
    capKm: round(p.capKm, 2),
    estKm: round(p.estKm, 2),
    totalKm: p.totalKm,
    waiting: p.waiting,
    inTransition: p.inTransition,
    source: p.source,
  };
}

function toPrediction(computed: ComputedAthlete): PredictionDto | null {
  const p = computed.prediction;
  if (!p) return null;
  const e = p.explanation;
  return {
    method: p.method,
    atCheckpointLabel: p.atCheckpointLabel,
    finishAt: p.finishAt,
    totalMs: p.totalMs,
    rangeLowMs: p.rangeLowMs,
    rangeHighMs: p.rangeHighMs,
    explanation: {
      neighbourCount: e.neighbourCount,
      yearBreakdown: Object.fromEntries(
        Object.entries(e.yearBreakdown).map(([year, count]) => [year, count]),
      ),
      remainingP25Ms: e.remainingP25Ms,
      remainingMedianMs: e.remainingMedianMs,
      remainingP75Ms: e.remainingP75Ms,
      ownSpeedKmh: e.ownSpeedKmh === null ? null : round(e.ownSpeedKmh, 1),
      neighbourSpeedKmh: e.neighbourSpeedKmh === null ? null : round(e.neighbourSpeedKmh, 1),
      extrapolationMs: e.extrapolationMs,
      backtestMedianErrorMs: e.backtestMedianErrorMs,
      backtestWithin25MinPct: e.backtestWithin25MinPct,
      note: e.note,
    },
  };
}

function toDisciplines(computed: ComputedAthlete): DisciplineDto[] {
  return computed.disciplines.map((d) => ({
    discipline: d.discipline,
    label: d.label,
    km: d.km,
    timeMs: d.timeMs,
    provisional: d.provisional,
    measuredKm: d.measuredKm,
    atCheckpointLabel: d.atCheckpointLabel,
    ranks: toRankSet(d.ranks),
    speedKmh: d.speedKmh === null ? null : round(d.speedKmh, 1),
  }));
}

export function toAthleteSummary(computed: ComputedAthlete): AthleteSummaryDto {
  const { athlete } = computed;
  return {
    bib: athlete.bib,
    name: athlete.name,
    division: athlete.division,
    ageGroupId: athlete.ageGroup?.id ?? null,
    ageGroupLabel: athlete.ageGroup?.label ?? null,
    sex: athlete.sex,
    status: computed.status,
    startAt: athlete.startAt,
    lastCheckpointLabel: computed.lastCheckpointLabel,
    lastPassedAt: computed.lastPassedAt,
    elapsedMs: computed.elapsedMs,
    totalRanks: toRankSet(computed.totalRanks),
    disciplines: toDisciplines(computed),
    position: toPosition(computed),
    prediction: toPrediction(computed),
    officialTotal: athlete.officialTotal,
    remark: athlete.remark,
    _links: athleteLinks(computed),
  };
}

function toSplits(computed: ComputedAthlete): SplitDto[] {
  return computed.splits.map((s) => ({
    checkpointId: s.checkpointId,
    label: s.label,
    discipline: s.discipline,
    km: s.km,
    kmInferred: s.kmInferred,
    passedAt: s.passedAt,
    elapsedMs: s.elapsedMs,
    segmentMs: s.segmentMs,
    segmentKm: s.segmentKm === null ? null : round(s.segmentKm, 2),
    segmentSpeedKmh: s.segmentSpeedKmh === null ? null : round(s.segmentSpeedKmh, 1),
    segmentRank: toRank(s.segmentRank),
    segmentRanks: toRankSet(s.segmentRanks),
    cumulativeRanks: toRankSet(s.cumulativeRanks),
  }));
}

function paceOf(discipline: string, timeMs: number, km: number): string {
  if (discipline === "swim") return formatSwimPace(timeMs, km);
  if (discipline === "bike") return formatBikeSpeed(timeMs, km);
  return formatRunPace(timeMs, km);
}

function toPastResults(computed: ComputedAthlete): PastResultDto[] {
  return computed.pastResults.map((r) => ({
    year: r.year,
    division: r.division,
    totalText: r.totalText ?? formatDuration(r.totalMs),
    totalMs: r.totalMs,
    divisionRank: { rank: r.divisionRank.rank, of: r.divisionRank.of },
    ageRank: toRank(r.ageRank),
    ageGroupId: r.ageGroupId,
    disciplines: r.disciplines.map((d) => ({
      discipline: d.discipline,
      label: DISCIPLINE_LABELS[d.discipline],
      timeMs: d.timeMs,
      km: d.km,
      paceText: paceOf(d.discipline, d.timeMs, d.km),
      divisionRank: toRank(d.divisionRank),
      ageRank: toRank(d.ageRank),
    })),
  }));
}

export function toMapEntry(computed: ComputedAthlete, isSelf = false): MapEntryDto {
  return {
    bib: computed.athlete.bib,
    name: computed.athlete.name,
    ageGroupId: computed.athlete.ageGroup?.id ?? null,
    status: computed.status,
    fieldOrder: computed.fieldOrder,
    divisionRank: toRank(computed.totalRanks.division),
    position: toPosition(computed),
    ...(isSelf ? { isSelf: true } : {}),
    _links: athleteRefLinks(computed.athlete.bib),
  };
}

/**
 * The handful of athletes either side of this one on the course, read off
 * the division's field order that the snapshot already holds.
 *
 * `ageGroupId` narrows it to the athlete's own age group, which is who they
 * are actually racing; passing null keeps the whole type, which is what a
 * supporter wants when they ask how far off the front their friend is. A
 * relay has no age group and only ever gets the whole type.
 */
function neighbourEntries(
  snapshot: ComputedSnapshot,
  computed: ComputedAthlete,
  ageGroupId: string | null,
  each = 5,
): MapEntryDto[] {
  const self = computed.athlete.bib;
  const order = snapshot.byDivision[computed.athlete.division];
  const rivals =
    ageGroupId === null
      ? order
      : order.filter((bib) => snapshot.athletes.get(bib)?.athlete.ageGroup?.id === ageGroupId);

  const index = rivals.indexOf(self);
  if (index < 0) return [toMapEntry(computed, true)];

  return rivals.slice(Math.max(0, index - each), index + each + 1).flatMap((bib) => {
    const rival = snapshot.athletes.get(bib);
    return rival ? [toMapEntry(rival, bib === self)] : [];
  });
}

export function toAthleteDetail(
  snapshot: ComputedSnapshot,
  computed: ComputedAthlete,
): AthleteDetailDto {
  return {
    ...toAthleteSummary(computed),
    splits: toSplits(computed),
    rankHistory: computed.rankHistory.map((entry) => ({
      checkpointId: entry.checkpointId,
      label: entry.label,
      ranks: toRankSet(entry.ranks),
    })),
    pastResults: toPastResults(computed),
    neighbours: {
      ageGroup:
        computed.athlete.ageGroup === null
          ? null
          : neighbourEntries(snapshot, computed, computed.athlete.ageGroup.id),
      overall: neighbourEntries(snapshot, computed, null),
    },
  };
}

export function toRaceState(snapshot: ComputedSnapshot): RaceStateDto {
  // Count everyone entered, not just those currently scored: before the start
  // nobody is racing yet, and a division showing zero entrants reads as a
  // failure rather than as a race that has not begun.
  const entrants: Record<Division, number> = { A: 0, B: 0, RA: 0, RB: 0 };
  for (const computed of snapshot.athletes.values()) {
    entrants[computed.athlete.division] += 1;
  }

  return {
    year: snapshot.year,
    fetchedAt: snapshot.fetchedAt,
    // In replay the race clock runs faster than the wall clock, so carry the
    // last computed race time forward at the replay speed rather than at 1x.
    now: snapshot.replay
      ? snapshot.computedAt + (Date.now() - snapshot.fetchedAt) * snapshot.clockSpeed
      : Date.now(),
    stale: snapshot.stale,
    replay: snapshot.replay,
    pollIntervalMs: snapshot.pollIntervalMs,
    finalResults: snapshot.finalResults,
    raceDate: snapshot.config.raceDate,
    counts: Object.fromEntries(
      DIVISIONS.map((id) => [id, { ...snapshot.counts[id] }]),
    ) as RaceStateDto["counts"],
    divisions: DIVISIONS.map((id) => ({
      id,
      label: DIVISION_LABELS[id],
      entrants: entrants[id],
      racing: snapshot.populations[id].all.length,
      waveStart: snapshot.config.divisions[id].waveStart,
      swimKm: snapshot.config.divisions[id].swimKm,
      checkpoints: snapshot.config.divisions[id].checkpoints
        .filter((c) => c.id !== "start")
        .map((c) => ({ id: c.id, label: c.label, km: c.km, discipline: c.discipline })),
    })),
    _links: {
      self: { href: "/api/race" },
      athletes: { href: "/api/athletes" },
      map: { href: "/api/map" },
      weather: { href: "/api/weather" },
    },
  };
}
