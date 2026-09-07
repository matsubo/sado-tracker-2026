"use client";

import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { Discipline } from "@/config/races";
import type { DisciplineDto } from "@/lib/api/contract";
import { formatDuration, formatRankOrDash, legPaceText } from "@/lib/format";
import { cn } from "@/lib/utils/cn";

const DASH = "—";

const TONE: Record<Discipline, string> = {
  swim: "text-[color:var(--swim)]",
  bike: "text-[color:var(--bike)]",
  run: "text-[color:var(--run)]",
};

interface DisciplineTableProps {
  readonly rows: readonly DisciplineDto[];
}

/**
 * Swim, bike and run side by side: time, pace and ranks.
 *
 * Only legs that are over. A leg still being raced used to sit here with its
 * full distance beside a part-way time, which read as the whole leg run in
 * that time; it is now summarised beside the estimated position instead.
 */
export function DisciplineTable({ rows }: DisciplineTableProps): React.JSX.Element {
  return (
    // `min-w-max` keeps the table at its content width so the wrapper
    // scrolls instead of squeezing the last column off a phone.
    <Table className="min-w-max">
      <THead>
        <TR>
          <TH align="left">種目</TH>
          <TH>タイム</TH>
          <TH>ペース</TH>
          <TH>総合</TH>
          <TH>エイジ</TH>
        </TR>
      </THead>
      <TBody>
        {rows.map((row) => {
          const missing = row.timeMs === null || row.provisional;
          return (
            <TR key={row.discipline} className={cn(missing && "text-muted-foreground")}>
              <TD align="left" className={cn("font-bold", !missing && TONE[row.discipline])}>
                {row.label} <span className="whitespace-nowrap">{row.km}km</span>
              </TD>
              <TD className="font-semibold text-[13px]">
                {missing ? DASH : formatDuration(row.timeMs as number)}
              </TD>
              <TD>{missing ? DASH : legPaceText(row)}</TD>
              <TD>
                {missing
                  ? DASH
                  : formatRankOrDash(
                      row.ranks.division?.rank ?? null,
                      row.ranks.division?.of ?? null,
                    )}
              </TD>
              <TD>
                {missing
                  ? DASH
                  : formatRankOrDash(
                      row.ranks.ageGroup?.rank ?? null,
                      row.ranks.ageGroup?.of ?? null,
                    )}
              </TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}
