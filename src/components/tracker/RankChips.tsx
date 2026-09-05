import type { DisciplineDto } from "@/lib/api/contract";
import { formatBikeSpeed, formatDuration, formatRunPace, formatSwimPace } from "@/lib/format";
import { cn } from "@/lib/utils/cn";

const TEXT: Record<string, string> = {
  swim: "text-[color:var(--swim)]",
  bike: "text-[color:var(--bike)]",
  run: "text-[color:var(--run)]",
};

function paceText(row: DisciplineDto): string | null {
  if (row.timeMs === null) return null;
  const km = row.provisional ? null : row.km;
  if (row.discipline === "bike") {
    return row.speedKmh === null ? null : `${row.speedKmh.toFixed(1)} km/h`;
  }
  if (km === null) return null;
  return row.discipline === "swim" ? formatSwimPace(row.timeMs, km) : formatRunPace(row.timeMs, km);
}

/** One line per discipline: time, then who the athlete is ahead of. */
export function DisciplineLines({ disciplines }: { disciplines: readonly DisciplineDto[] }) {
  return (
    <dl className="divide-y divide-border border-border border-t">
      {disciplines.map((row) => {
        const pace = paceText(row);
        const missing = row.timeMs === null;
        return (
          <div
            key={row.discipline}
            className={cn(
              "grid grid-cols-[44px_78px_1fr] items-center gap-2 py-1.5 text-[12px]",
              missing && "text-muted-foreground",
            )}
          >
            <dt className={cn("font-bold", !missing && TEXT[row.discipline])}>{row.label}</dt>
            <dd className="font-semibold text-[15px] tabular-nums">
              {missing ? "—" : formatDuration(row.timeMs as number)}
              {row.provisional && !missing ? (
                <sup className="ml-0.5 font-bold text-[9px] text-[color:var(--bike)]">暫定</sup>
              ) : null}
            </dd>
            <dd className="text-[12px] text-muted-foreground leading-snug tabular-nums">
              {missing ? (
                row.discipline === "swim" ? "未計測" : "未スタート"
              ) : (
                <>
                  {row.atCheckpointLabel ? `${row.atCheckpointLabel}まで · ` : null}
                  {row.ranks.division ? (
                    <>
                      部門{" "}
                      <b className="font-semibold text-foreground">{row.ranks.division.rank}</b>/
                      {row.ranks.division.of}
                    </>
                  ) : null}
                  {row.ranks.ageGroup ? (
                    <>
                      {" · エイジ "}
                      <b className="font-semibold text-foreground">{row.ranks.ageGroup.rank}</b>/
                      {row.ranks.ageGroup.of}
                    </>
                  ) : null}
                  {pace ? ` · ${pace}` : null}
                  {row.deviation !== null ? (
                    <span className="ml-1 rounded bg-muted px-1.5 py-px text-[11px]">
                      偏 {row.deviation}
                    </span>
                  ) : null}
                </>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export { paceText, formatBikeSpeed };
