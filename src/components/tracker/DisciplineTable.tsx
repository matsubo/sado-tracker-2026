"use client";

import type { Discipline } from "@/config/races";
import type { DisciplineDto, SplitDto } from "@/lib/api/contract";
import {
  formatBikeSpeed,
  formatDeviation,
  formatDuration,
  formatRankOrDash,
  formatRunPace,
  formatSpeedKmh,
  formatSwimPace,
} from "@/lib/format";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { cn } from "@/lib/utils/cn";

const DASH = "—";

const TONE: Record<Discipline, string> = {
  swim: "text-[color:var(--swim)]",
  bike: "text-[color:var(--bike)]",
  run: "text-[color:var(--run)]",
};

/**
 * Distance the row's time actually covers.
 *
 * A finished leg covers its full distance, but a leg still in progress is
 * timed to an intermediate point, so its pace has to be taken against the
 * distance of that point rather than the whole leg. The wire format names the
 * point but not its distance, so it is looked up in the splits.
 */
function pacedKm(row: DisciplineDto, splits: readonly SplitDto[]): number | null {
  if (!row.provisional) return row.km;
  if (row.atCheckpointLabel === null) return null;
  const split = splits.find((entry) => entry.label === row.atCheckpointLabel);
  return split?.km ?? null;
}

/** Pace or speed for a leg, in the unit that discipline is usually read in. */
function paceText(row: DisciplineDto, splits: readonly SplitDto[]): string {
  if (row.timeMs === null) return DASH;
  if (row.discipline === "bike" && row.speedKmh !== null) return formatSpeedKmh(row.speedKmh);
  const km = pacedKm(row, splits);
  if (km === null) return DASH;
  if (row.discipline === "swim") return formatSwimPace(row.timeMs, km);
  if (row.discipline === "bike") return formatBikeSpeed(row.timeMs, km);
  return formatRunPace(row.timeMs, km);
}

interface DisciplineTableProps {
  readonly rows: readonly DisciplineDto[];
  readonly splits: readonly SplitDto[];
}

/** Swim, bike and run side by side: time, pace, ranks and deviation score. */
export function DisciplineTable({ rows, splits }: DisciplineTableProps): React.JSX.Element {
  return (
    <Table>
      <THead>
        <TR>
          <TH align="left">種目</TH>
          <TH>タイム</TH>
          <TH>ペース</TH>
          <TH>部門</TH>
          <TH>エイジ</TH>
          <TH>偏差値</TH>
        </TR>
      </THead>
      <TBody>
        {rows.map((row) => {
          const missing = row.timeMs === null;
          return (
            <TR key={row.discipline} className={cn(missing && "text-muted-foreground")}>
              <TD align="left" className={cn("font-bold", !missing && TONE[row.discipline])}>
                {row.label} {row.km}km
              </TD>
              <TD className="font-semibold text-[13px]">
                {missing ? DASH : formatDuration(row.timeMs as number)}
                {row.provisional && !missing ? (
                  <sup
                    className="ml-0.5 font-bold text-[9px] text-[color:var(--run)]"
                    title={
                      row.atCheckpointLabel
                        ? `${row.atCheckpointLabel} までの暫定値`
                        : "進行中の暫定値"
                    }
                  >
                    暫定
                  </sup>
                ) : null}
              </TD>
              <TD>{paceText(row, splits)}</TD>
              <TD>{formatRankOrDash(row.ranks.division?.rank ?? null, row.ranks.division?.of ?? null)}</TD>
              <TD>{formatRankOrDash(row.ranks.ageGroup?.rank ?? null, row.ranks.ageGroup?.of ?? null)}</TD>
              <TD>{formatDeviation(row.deviation)}</TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}
