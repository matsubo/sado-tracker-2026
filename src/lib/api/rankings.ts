import type { Discipline, Division } from "@/config/races";
import { disciplineEnd, disciplineKm, disciplineStart, splitBetween } from "@/lib/compute/elapsed";
import type { ComputedSnapshot } from "@/lib/compute/snapshot";
import type { Athlete } from "@/lib/domain/types";
import { formatBikeSpeed, formatRunPace, formatSwimPace } from "@/lib/format";
import type { RankingPageDto, RankingRowDto } from "./contract";

export type RankingDiscipline = Discipline | "total";

const MEASURED_AT: Record<RankingDiscipline, string> = {
  swim: "スイム完了",
  bike: "バイク完了",
  run: "ラン完了",
  total: "フィニッシュ",
};

function timeOf(athlete: Athlete, discipline: RankingDiscipline): number | null {
  if (discipline === "total") return splitBetween(athlete, "start", "finish");
  return splitBetween(athlete, disciplineStart(discipline), disciplineEnd(discipline));
}

function endCheckpoint(discipline: RankingDiscipline): string {
  return discipline === "total" ? "finish" : disciplineEnd(discipline);
}

function paceText(discipline: RankingDiscipline, timeMs: number, km: number): string {
  if (discipline === "swim") return formatSwimPace(timeMs, km);
  if (discipline === "bike") return formatBikeSpeed(timeMs, km);
  if (discipline === "run") return formatRunPace(timeMs, km);
  return "";
}

export interface RankingQuery {
  readonly division: Division;
  readonly discipline: RankingDiscipline;
  readonly ageGroupId: string | null;
  /** Null means the caller expressed no preference, so the target may lead. */
  readonly page: number | null;
  readonly perPage: number;
  readonly targetBib: string | null;
}

/**
 * A ranking table for one discipline. Only athletes who have completed the
 * discipline appear, so the table is definitive as far as it goes; the header
 * states how many that is, and a target athlete who has not finished it yet
 * gets a line saying where they are instead.
 */
export function buildRankingPage(snapshot: ComputedSnapshot, query: RankingQuery): RankingPageDto {
  const { division, discipline, ageGroupId, page, perPage, targetBib } = query;
  const course = snapshot.config.divisions[division];
  const pop = snapshot.populations[division];
  const km = discipline === "total" ? 0 : disciplineKm(discipline, course);

  const measured = pop
    .atCheckpoint(endCheckpoint(discipline))
    .filter((a) => timeOf(a, discipline) !== null)
    .filter((a) => ageGroupId === null || a.ageGroup?.id === ageGroupId)
    .map((athlete) => ({ athlete, timeMs: timeOf(athlete, discipline) as number }))
    .sort((a, b) => a.timeMs - b.timeMs);

  // Without a chosen athlete the useful comparison is the leader: a column of
  // dashes tells the reader nothing, and "how far behind the front" is what a
  // results table is normally read for.
  const target = targetBib
    ? (measured.find((entry) => entry.athlete.bib === targetBib) ?? null)
    : null;
  const basisEntry = target ?? measured[0] ?? null;
  const basisTime = basisEntry?.timeMs ?? null;
  const diffBasis = basisEntry
    ? {
        kind: (target ? "athlete" : "leader") as "athlete" | "leader",
        name: basisEntry.athlete.name,
      }
    : null;

  const rows: RankingRowDto[] = measured.map((entry) => {
    const ahead = measured.filter((other) => other.timeMs < entry.timeMs).length;
    return {
      rank: ahead + 1,
      bib: entry.athlete.bib,
      name: entry.athlete.name,
      ageGroupId: entry.athlete.ageGroup?.id ?? null,
      timeMs: entry.timeMs,
      paceText: paceText(discipline, entry.timeMs, km),
      diffMs: basisTime === null ? null : entry.timeMs - basisTime,
      isTarget: entry.athlete.bib === targetBib,
    };
  });

  // Open on the target athlete's page when the caller did not name one. Once
  // the reader pages themselves, their choice stands: re-centring on every
  // page 1 would make the pages before the target unreachable.
  const targetIndex = rows.findIndex((row) => row.isTarget);
  const effectivePage = page ?? (targetIndex >= 0 ? Math.floor(targetIndex / perPage) + 1 : 1);
  const start = (effectivePage - 1) * perPage;

  const targetComputed = targetBib ? snapshot.athletes.get(targetBib) : undefined;
  const targetElsewhere =
    targetBib && targetIndex < 0 && targetComputed
      ? {
          bib: targetBib,
          name: targetComputed.athlete.name,
          message: targetComputed.lastCheckpointLabel
            ? `${targetComputed.athlete.name} は ${targetComputed.lastCheckpointLabel} を通過。${MEASURED_AT[discipline]}者の表にはまだ入っていません`
            : `${targetComputed.athlete.name} はまだ計測されていません`,
        }
      : null;

  return {
    division,
    discipline,
    ageGroupId,
    measuredAt: MEASURED_AT[discipline],
    diffBasis,
    total: rows.length,
    page: effectivePage,
    perPage,
    rows: rows.slice(start, start + perPage),
    targetElsewhere,
    _links: {
      self: {
        href: `/api/divisions/${division}/rankings?discipline=${discipline}&page=${effectivePage}`,
      },
    },
  };
}
