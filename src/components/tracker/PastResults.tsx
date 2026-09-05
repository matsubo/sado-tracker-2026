"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { PastResultDto } from "@/lib/api/contract";
import { formatDuration, formatRank } from "@/lib/format";
import { cn } from "@/lib/utils/cn";

interface PastResultsProps {
  readonly results: readonly PastResultDto[];
}

const TONE: Record<string, string> = {
  swim: "text-[color:var(--swim)]",
  bike: "text-[color:var(--bike)]",
  run: "text-[color:var(--run)]",
};

/**
 * Finishes from earlier years, matched by name. Each row opens to show that
 * year's swim, bike and run with the ranks they earned, because the total
 * alone does not say where the athlete gained or lost time.
 *
 * Distances are printed per row: the course has not been identical every
 * year, and comparing a pace without the distance would be misleading.
 */
export function PastResults({ results }: PastResultsProps): React.JSX.Element {
  const [open, setOpen] = useState<string | null>(null);

  if (results.length === 0) {
    return (
      <p className="px-1 text-[12px] text-muted-foreground">
        過去 4 年の完走記録は見つかりませんでした。
      </p>
    );
  }

  return (
    <ul className="flex list-none flex-col gap-1.5 p-0">
      {results.map((result) => {
        const key = `${result.year}-${result.division}-${result.totalMs}`;
        const expanded = open === key;
        return (
          <li key={key} className="overflow-hidden rounded-lg bg-muted">
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? null : key)}
              className="grid w-full grid-cols-[44px_32px_1fr_16px] items-center gap-2 px-2.5 py-2 text-left text-[12.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset tnum"
            >
              <b className="font-bold text-[14px]">{result.year}</b>
              <span className="font-semibold text-muted-foreground">{result.division}</span>
              <span className="text-muted-foreground">
                総合{" "}
                <strong className="font-semibold text-foreground">{result.totalText || "—"}</strong>{" "}
                · 部門{" "}
                <strong className="font-semibold text-foreground">
                  {formatRank(result.divisionRank.rank, result.divisionRank.of)}
                </strong>
                {result.ageRank === null ? null : (
                  <>
                    {" "}
                    · エイジ{" "}
                    <strong className="font-semibold text-foreground">
                      {formatRank(result.ageRank.rank, result.ageRank.of)}
                    </strong>
                  </>
                )}
              </span>
              <ChevronDown
                aria-hidden
                className={cn(
                  "size-4 text-muted-foreground transition-transform",
                  expanded && "rotate-180",
                )}
              />
            </button>

            {expanded ? (
              <div className="border-border border-t px-2.5 py-2">
                {result.disciplines.length === 0 ? (
                  <p className="text-[11.5px] text-muted-foreground">
                    この年は種目ごとの記録が残っていません。
                  </p>
                ) : (
                  <dl className="flex flex-col gap-1">
                    {result.disciplines.map((leg) => (
                      <div
                        key={leg.discipline}
                        className="grid grid-cols-[62px_66px_1fr] items-baseline gap-2 text-[12px] tnum"
                      >
                        <dt className={cn("font-bold", TONE[leg.discipline])}>
                          {leg.label}
                          <span className="ml-1 font-normal text-[10px] text-muted-foreground">
                            {leg.km}km
                          </span>
                        </dt>
                        <dd className="font-semibold">{formatDuration(leg.timeMs)}</dd>
                        <dd className="text-muted-foreground">
                          {leg.paceText}
                          {leg.divisionRank ? (
                            <>
                              {" · 部門 "}
                              <strong className="font-semibold text-foreground">
                                {formatRank(leg.divisionRank.rank, leg.divisionRank.of)}
                              </strong>
                            </>
                          ) : null}
                          {leg.ageRank ? (
                            <>
                              {" · エイジ "}
                              <strong className="font-semibold text-foreground">
                                {formatRank(leg.ageRank.rank, leg.ageRank.of)}
                              </strong>
                            </>
                          ) : null}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
