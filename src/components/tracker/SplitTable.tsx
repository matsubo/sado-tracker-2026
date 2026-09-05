"use client";

import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { SplitDto } from "@/lib/api/contract";
import {
  formatClock,
  formatDuration,
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

interface SplitTableProps {
  readonly splits: readonly SplitDto[];
}

/** Every timing point the athlete has passed, newest at the bottom. */
export function SplitTable({ splits }: SplitTableProps): React.JSX.Element {
  return (
    <Table>
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
        {splits.map((split) => (
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
            <TD>{split.segmentMs === null ? DASH : formatDuration(split.segmentMs)}</TD>
            <TD>{segmentSpeed(split)}</TD>
            <TD>
              {split.segmentRank === null
                ? DASH
                : formatRank(split.segmentRank.rank, split.segmentRank.of)}
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
