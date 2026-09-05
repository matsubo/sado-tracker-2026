"use client";

import type { PastResultDto } from "@/lib/api/contract";
import { formatRank } from "@/lib/format";

interface PastResultsProps {
  readonly results: readonly PastResultDto[];
}

/**
 * Finishes from earlier years, matched by name. Athletes change division
 * between years, so the division is shown per row rather than assumed.
 */
export function PastResults({ results }: PastResultsProps): React.JSX.Element {
  if (results.length === 0) {
    return (
      <p className="px-1 text-[12px] text-muted-foreground">
        過去 4 年の完走記録は見つかりませんでした。
      </p>
    );
  }

  return (
    <ul className="flex list-none flex-col gap-1.5 p-0">
      {results.map((result) => (
        <li
          key={`${result.year}-${result.division}-${result.totalText}`}
          className="grid grid-cols-[44px_32px_1fr] items-center gap-2 rounded-lg bg-muted px-2.5 py-2 text-[12.5px] tnum"
        >
          <b className="font-bold text-[14px]">{result.year}</b>
          <span className="font-semibold text-muted-foreground">{result.division}</span>
          <span className="text-muted-foreground">
            総合{" "}
            <strong className="font-semibold text-foreground">{result.totalText || "—"}</strong> ·
            部門{" "}
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
        </li>
      ))}
    </ul>
  );
}
