import type { Division } from "@/config/races";
import type { ComputedAthlete, ComputedSnapshot } from "@/lib/compute/snapshot";
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
  SplitDto,
} from "./contract";

const DIVISIONS: readonly Division[] = ["A", "B", "RA", "RB"];

const DIVISION_LABELS: Record<Division, string> = {
  A: "Aタイプ",
  B: "Bタイプ",
  RA: "RAタイプ（リレー）",
  RB: "RBタイプ（リレー）",
};

/** External athlete page on the sibling results site. */
export function aiTriHref(name: string): string {
  return `https://ai-triathlon-result.teraren.com/athletes/${encodeURIComponent(name.replace(/　/g, " "))}`;
}

function athleteLinks(computed: ComputedAthlete): Links {
  return {
    self: { href: `/api/athletes/${computed.athlete.bib}` },
    page: { href: `/athletes/${computed.athlete.bib}` },
    division: { href: `/api/divisions/${computed.athlete.division}/rankings` },
    map: { href: `/api/map?div=${computed.athlete.division}` },
    aiTri: { href: aiTriHref(computed.athlete.name) },
  };
}

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
  return {
    method: p.method,
    atCheckpointLabel: p.atCheckpointLabel,
    finishAt: p.finishAt,
    totalMs: p.totalMs,
    rangeLowMs: p.rangeLowMs,
    rangeHighMs: p.rangeHighMs,
    explanation: {
      ...p.explanation,
      yearBreakdown: Object.fromEntries(
        Object.entries(p.explanation.yearBreakdown).map(([year, count]) => [year, count]),
      ),
      ownSpeedKmh: p.explanation.ownSpeedKmh === null ? null : round(p.explanation.ownSpeedKmh, 1),
      neighbourSpeedKmh:
        p.explanation.neighbourSpeedKmh === null ? null : round(p.explanation.neighbourSpeedKmh, 1),
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
    atCheckpointLabel: d.atCheckpointLabel,
    ranks: d.ranks,
    deviation: d.deviation === null ? null : Math.round(d.deviation),
    speedKmh: d.speedKmh === null ? null : round(d.speedKmh, 1),
  }));
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
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
    totalRanks: computed.totalRanks,
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
    ...s,
    segmentKm: s.segmentKm === null ? null : round(s.segmentKm, 2),
    segmentSpeedKmh: s.segmentSpeedKmh === null ? null : round(s.segmentSpeedKmh, 1),
  }));
}

function toPastResults(computed: ComputedAthlete): PastResultDto[] {
  return computed.pastResults.map((r) => ({
    year: r.year,
    division: r.division,
    totalText: r.totalText ?? "",
    divisionRank: r.divisionRank,
    ageRank: r.ageRank,
    ageGroupId: r.ageGroupId,
  }));
}

export function toMapEntry(
  computed: ComputedAthlete,
  isSelf = false,
): MapEntryDto {
  return {
    bib: computed.athlete.bib,
    name: computed.athlete.name,
    ageGroupId: computed.athlete.ageGroup?.id ?? null,
    status: computed.status,
    fieldOrder: computed.fieldOrder,
    divisionRank: computed.totalRanks.division,
    position: toPosition(computed),
    ...(isSelf ? { isSelf: true } : {}),
  };
}

/**
 * Age-group rivals immediately ahead of and behind an athlete, chosen by
 * estimated position so the strip reads as a live picture of the course.
 */
export function neighbourEntries(
  snapshot: ComputedSnapshot,
  computed: ComputedAthlete,
  each = 5,
): MapEntryDto[] {
  const ageGroupId = computed.athlete.ageGroup?.id;
  if (!ageGroupId) return [toMapEntry(computed, true)];

  const rivals = [...snapshot.athletes.values()]
    .filter(
      (other) =>
        other.athlete.division === computed.athlete.division &&
        other.athlete.ageGroup?.id === ageGroupId &&
        other.fieldOrder !== Number.MAX_SAFE_INTEGER,
    )
    .sort((a, b) => a.fieldOrder - b.fieldOrder);

  const index = rivals.findIndex((r) => r.athlete.bib === computed.athlete.bib);
  if (index < 0) return [toMapEntry(computed, true)];

  return rivals
    .slice(Math.max(0, index - each), index + each + 1)
    .map((r) => toMapEntry(r, r.athlete.bib === computed.athlete.bib));
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
      ranks: entry.ranks,
    })),
    pastResults: toPastResults(computed),
    neighbours: neighbourEntries(snapshot, computed),
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
    now: snapshot.replay ? snapshot.computedAt + (Date.now() - snapshot.fetchedAt) : Date.now(),
    stale: snapshot.stale,
    replay: snapshot.replay,
    counts: snapshot.counts,
    divisions: DIVISIONS.map((id) => ({
      id,
      label: DIVISION_LABELS[id],
      entrants: entrants[id],
      racing: snapshot.populations[id].all.length,
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
