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
const ORDER: readonly string[] = ["swim", "bike", "run"];

/**
 * A leg with no time is either still ahead of the athlete or already under
 * way with nothing measured yet. Saying "not started" for the second case
 * contradicts the status pill right above it.
 */
function emptyLabel(row: DisciplineDto, current: string): string {
  const at = ORDER.indexOf(row.discipline);
  const now = ORDER.indexOf(current);
  if (at > now) return "未スタート";
  return "計測待ち";
}

export function DisciplineLines({
  disciplines,
  current,
}: {
  readonly disciplines: readonly DisciplineDto[];
  readonly current: string;
}) {
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
            </dd>
            <dd className="text-[12px] text-muted-foreground leading-snug tabular-nums">
              {missing ? (
                emptyLabel(row, current)
              ) : (
                <>
                  {/* Naming the point the time reaches, rather than badging it
                      "provisional", is what stops a part-way time being read
                      as the whole leg. */}
                  {row.atCheckpointLabel ? (
                    <span className="font-semibold text-foreground">
                      {row.atCheckpointLabel}まで ·{" "}
                    </span>
                  ) : null}
                  {row.ranks.division ? (
                    <>
                      総合{" "}
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
                  {row.provisional && row.ranks.division ? (
                    <span className="text-[11px]">（通過者のみ）</span>
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

export { formatBikeSpeed, paceText };
