import type { DisciplineDto } from "@/lib/api/contract";
import { formatDuration, formatRank, legPaceText } from "@/lib/format";

interface Props {
  readonly leg: DisciplineDto;
}

/**
 * The leg the athlete is on right now: how far they have been measured, the
 * time to that point, and where that puts them among the people who have also
 * reached it.
 *
 * It lives beside the estimated position rather than in the table of legs.
 * In the table a part-way time sat next to the leg's full distance, so
 * "ラン 42.2km ... 1:51:05" read as a 21 km half marathon run in 111 minutes.
 * Nothing here is a completed leg, and nothing in the table is unfinished.
 */
export function InProgressLeg({ leg }: Props) {
  if (leg.timeMs === null) return null;

  const point = leg.atCheckpointLabel ?? `${leg.measuredKm}km`;
  const division = leg.ranks.division;
  const ageGroup = leg.ranks.ageGroup;

  return (
    <div className="mt-2 text-[12px] text-muted-foreground tabular-nums">
      <p>
        <span className="font-semibold text-foreground">{point}まで</span>{" "}
        <b className="font-bold text-[13px] text-foreground">{formatDuration(leg.timeMs)}</b>
        {" · "}
        {legPaceText(leg)}
      </p>
      {division || ageGroup ? (
        <p className="mt-0.5">
          {division ? (
            <>
              {"総合 "}
              <b className="font-semibold text-foreground">
                {formatRank(division.rank, division.of)}
              </b>
            </>
          ) : null}
          {division && ageGroup ? " · " : null}
          {ageGroup ? (
            <>
              {"エイジ "}
              <b className="font-semibold text-foreground">
                {formatRank(ageGroup.rank, ageGroup.of)}
              </b>
            </>
          ) : null}
          <span className="ml-1 text-[11px]">（通過者のみ）</span>
        </p>
      ) : null}
    </div>
  );
}
