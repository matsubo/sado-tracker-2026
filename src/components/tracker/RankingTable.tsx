import Link from "next/link";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { RankingRowDto } from "@/lib/api/contract";
import { formatDiff, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils/cn";

const DASH = "—";
const MEDAL_RANKS = 3;

/** Column head for the time and pace columns, which depend on the discipline. */
const PACE_HEADS: Readonly<Record<string, string>> = {
  swim: "/100m",
  bike: "km/h",
  run: "/km",
  total: "ペース",
};

const TIME_HEADS: Readonly<Record<string, string>> = {
  swim: "スイム",
  bike: "バイク",
  run: "ラン",
  total: "総合",
};

interface RankingTableProps {
  readonly rows: readonly RankingRowDto[];
  readonly discipline: string;
}

/** Green when the athlete is faster than the target, red when slower. */
function diffClass(diffMs: number | null): string {
  if (diffMs === null || diffMs === 0) return "text-muted-foreground";
  return diffMs < 0 ? "text-[color:var(--good)]" : "text-[color:var(--bad)]";
}

/**
 * One page of a division ranking. The table is wider than a phone, so the
 * shared `Table` primitive keeps it inside its own horizontal scroller
 * instead of stretching the page.
 */
export function RankingTable({ rows, discipline }: RankingTableProps) {
  return (
    <Table wrapperClassName="px-3">
      <caption className="sr-only">{TIME_HEADS[discipline] ?? "総合"}の順位表</caption>
      <THead>
        <TR>
          <TH>順位</TH>
          <TH align="left">名前</TH>
          <TH align="left">年齢</TH>
          <TH>{TIME_HEADS[discipline] ?? "タイム"}</TH>
          <TH>{PACE_HEADS[discipline] ?? "ペース"}</TH>
          <TH>差</TH>
        </TR>
      </THead>
      <TBody>
        {rows.map((row) => (
          <TR key={row.bib} className={cn(row.isTarget && "bg-[color:var(--highlight)]")}>
            <TD className={cn(row.rank <= MEDAL_RANKS && "font-bold text-[color:var(--bike)]")}>
              {row.rank}
            </TD>
            <TD align="left">
              <Link
                href={`/athletes/${row.bib}`}
                className={cn(
                  "rounded-sm underline underline-offset-2 outline-none",
                  "focus-visible:ring-2 focus-visible:ring-ring",
                  row.isTarget ? "font-bold text-foreground no-underline" : "text-primary",
                )}
              >
                {row.name}
              </Link>
            </TD>
            <TD align="left" className="text-muted-foreground">
              {row.ageGroupId ?? DASH}
            </TD>
            <TD className="font-semibold text-[12.5px]">{formatDuration(row.timeMs)}</TD>
            <TD className="text-muted-foreground">{row.paceText === "" ? DASH : row.paceText}</TD>
            <TD className={diffClass(row.diffMs)}>
              {row.diffMs === null ? DASH : formatDiff(row.diffMs)}
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
