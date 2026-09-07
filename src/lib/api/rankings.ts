import type { Division } from "@/config/races";
import { disciplineKm } from "@/lib/compute/elapsed";
import type { ComputedSnapshot } from "@/lib/compute/snapshot";
import { competitionRanks, type RankingDiscipline } from "@/lib/compute/tables";
import { formatBikeSpeed, formatRunPace, formatSwimPace } from "@/lib/format";
import type { RankingPageDto, RankingRowDto } from "./contract";

const MEASURED_AT: Record<RankingDiscipline, string> = {
  swim: "スイム完了",
  bike: "バイク完了",
  run: "ラン完了",
  total: "フィニッシュ",
};

function paceText(discipline: RankingDiscipline, timeMs: number, km: number): string {
  if (discipline === "swim") return formatSwimPace(timeMs, km);
  if (discipline === "bike") return formatBikeSpeed(timeMs, km);
  if (discipline === "run") return formatRunPace(timeMs, km);
  return "";
}

interface RankingQuery {
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
 *
 * The snapshot already holds the sorted, ranked table for the whole division,
 * so a page is a filter and a slice. Only an age-group view ranks again,
 * because a rank within the group is not the rank within the type.
 */
export function buildRankingPage(snapshot: ComputedSnapshot, query: RankingQuery): RankingPageDto {
  const { division, discipline, ageGroupId, page, perPage, targetBib } = query;
  const course = snapshot.config.divisions[division];
  const km = discipline === "total" ? 0 : disciplineKm(discipline, course);

  const table = snapshot.rankings[division][discipline];
  const measured =
    ageGroupId === null ? table : table.filter((entry) => entry.ageGroupId === ageGroupId);
  const ranks =
    ageGroupId === null
      ? measured.map((entry) => entry.rank)
      : competitionRanks(measured.map((entry) => entry.timeMs));

  // Without a chosen athlete the useful comparison is the leader: a column of
  // dashes tells the reader nothing, and "how far behind the front" is what a
  // results table is normally read for.
  const targetIndex = targetBib === null ? -1 : measured.findIndex((e) => e.bib === targetBib);
  const basisEntry = (targetIndex >= 0 ? measured[targetIndex] : measured[0]) ?? null;
  const basisTime = basisEntry?.timeMs ?? null;
  const diffBasis = basisEntry
    ? {
        kind: (targetIndex >= 0 ? "athlete" : "leader") as "athlete" | "leader",
        name: basisEntry.name,
      }
    : null;

  // Open on the target athlete's page when the caller did not name one. Once
  // the reader pages themselves, their choice stands: re-centring on every
  // page 1 would make the pages before the target unreachable.
  const effectivePage = page ?? (targetIndex >= 0 ? Math.floor(targetIndex / perPage) + 1 : 1);
  const start = (effectivePage - 1) * perPage;

  const rows: RankingRowDto[] = measured.slice(start, start + perPage).map((entry, offset) => ({
    rank: ranks[start + offset] as number,
    bib: entry.bib,
    name: entry.name,
    ageGroupId: entry.ageGroupId,
    timeMs: entry.timeMs,
    paceText: paceText(discipline, entry.timeMs, km),
    diffMs: basisTime === null ? null : entry.timeMs - basisTime,
    isTarget: entry.bib === targetBib,
  }));

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
    total: measured.length,
    page: effectivePage,
    perPage,
    rows,
    targetElsewhere,
    _links: {
      self: {
        href: `/api/divisions/${division}/rankings?discipline=${discipline}&page=${effectivePage}`,
      },
    },
  };
}
