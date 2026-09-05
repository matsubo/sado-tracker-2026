"use client";

import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { SplitDto } from "@/lib/api/contract";
import {
  formatClock,
  formatDuration,
  formatDurationShort,
  formatRank,
  formatRunPace,
  formatSpeedKmh,
  formatSwimPace,
} from "@/lib/format";
import { cn } from "@/lib/utils/cn";

const DASH = "—";

const TONE: Record<string, string> = {
  swim: "text-[color:var(--swim)]",
  bike: "text-[color:var(--bike)]",
  run: "text-[color:var(--run)]",
  transition: "text-muted-foreground",
};

/** Segment speed in the unit that discipline is read in. */
function segmentSpeed(split: SplitDto): string {
  const { segmentMs, segmentKm } = split;
  if (segmentMs === null || segmentKm === null || segmentKm <= 0) return DASH;
  if (split.discipline === "bike") {
    return split.segmentSpeedKmh === null ? DASH : formatSpeedKmh(split.segmentSpeedKmh);
  }
  if (split.discipline === "run") return formatRunPace(segmentMs, segmentKm);
  if (split.discipline === "swim") return formatSwimPace(segmentMs, segmentKm);
  return DASH;
}

/** A timing point on the course, as the race state describes it. */
interface CourseCheckpoint {
  readonly id: string;
  readonly label: string;
  readonly discipline: string;
  readonly km: number;
}

interface SplitTableProps {
  readonly splits: readonly SplitDto[];
  /** Every timing point on the course, so the ones still ahead are listed. */
  readonly checkpoints?: readonly CourseCheckpoint[];
}

/**
 * Every timing point on the course in order, whether or not it has recorded
 * anything. Listing only the points already passed hides the shape of the
 * course, so a reader cannot see what is still to come or how many readings
 * are missing.
 */
export function SplitTable({ splits, checkpoints }: SplitTableProps): React.JSX.Element {
  const measured = new Map(splits.map((split) => [split.checkpointId, split]));
  const rows: readonly (
    | { kind: "measured"; split: SplitDto }
    | { kind: "pending"; row: CourseCheckpoint }
  )[] =
    checkpoints && checkpoints.length > 0
      ? checkpoints.map((row) => {
          const split = measured.get(row.id);
          return split
            ? ({ kind: "measured", split } as const)
            : ({ kind: "pending", row } as const);
        })
      : splits.map((split) => ({ kind: "measured", split }) as const);
  return (
    // `min-w-max` keeps the table at its content width so the wrapper
    // scrolls instead of squeezing the last column (区間順位) off a phone.
    <Table className="min-w-max">
      <THead>
        <TR>
          <TH align="left">計測点</TH>
          <TH>通過</TH>
          <TH>経過</TH>
          <TH>区間</TH>
          <TH>速度</TH>
          <TH>区間順位</TH>
        </TR>
      </THead>
      <TBody>
        {rows.map((row) => {
          if (row.kind === "pending") {
            const { row: pending } = row;
            return (
              <TR key={pending.id} className="text-muted-foreground">
                <TD align="left" className="font-semibold">
                  {pending.label} <span className="font-normal">{pending.km}km</span>
                </TD>
                <TD colSpan={5} align="left" className="text-[11px]">
                  未通過
                </TD>
              </TR>
            );
          }

          const { split } = row;
          return (
            <TR key={split.checkpointId}>
              <TD align="left" className={cn("font-semibold", TONE[split.discipline])}>
                {split.label}{" "}
                <span
                  className="font-normal text-muted-foreground"
                  title={split.kmInferred ? "距離は区間比から推定した値です" : undefined}
                >
                  {split.km}km{split.kmInferred ? "（推定）" : ""}
                </span>
              </TD>
              <TD>{formatClock(split.passedAt)}</TD>
              <TD>{formatDuration(split.elapsedMs)}</TD>
              <TD>{split.segmentMs === null ? DASH : formatDurationShort(split.segmentMs)}</TD>
              <TD>{segmentSpeed(split)}</TD>
              <TD>
                {split.segmentRank === null
                  ? DASH
                  : formatRank(split.segmentRank.rank, split.segmentRank.of)}
              </TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}
