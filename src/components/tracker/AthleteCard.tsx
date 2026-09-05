"use client";

import Link from "next/link";
import { Star, X } from "lucide-react";
import type { AthleteSummaryDto } from "@/lib/api/contract";
import { formatClock, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils/cn";
import { DisciplineLines } from "./RankChips";
import { PositionBar } from "./PositionBar";
import { PredictionSummary } from "./PredictionSummary";
import { StatusPill } from "./StatusPill";

const STRIPE: Record<string, string> = {
  swim: "bg-[color:var(--swim)]",
  bike: "bg-[color:var(--bike)]",
  run: "bg-[color:var(--run)]",
};

interface Props {
  readonly athlete: AthleteSummaryDto;
  readonly unread: boolean;
  readonly nextLabel?: string | null;
  readonly onRemove?: (bib: string) => void;
}

/** One friend, summarised: where they are, how they rank, when they finish. */
export function AthleteCard({ athlete, unread, nextLabel, onRemove }: Props) {
  const finished = athlete.status === "finished";
  const stripe = finished ? "bg-muted-foreground" : STRIPE[athlete.position.discipline];

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-lg border bg-card",
        unread ? "border-[color:var(--brand-ring,#00d3f2)] ring-2 ring-[#00d3f2]/25" : "border-border",
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", stripe)} aria-hidden />

      <div className="flex items-baseline gap-2 py-3 pr-3 pl-4">
        {unread ? (
          <span className="h-2 w-2 shrink-0 self-center rounded-full bg-destructive" aria-label="新着" />
        ) : null}
        <Link
          href={`/athletes/${athlete.bib}`}
          className="rounded font-bold text-[17px] hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        >
          {athlete.name}
        </Link>
        <span className="font-semibold text-[13px] text-muted-foreground tabular-nums">
          #{athlete.bib}
        </span>
        <span className="ml-auto whitespace-nowrap rounded border border-border px-1.5 py-px text-[11px] text-muted-foreground">
          {athlete.division} · {athlete.ageGroupLabel ?? "リレー"}
        </span>
        {onRemove ? (
          <button
            type="button"
            onClick={() => onRemove(athlete.bib)}
            aria-label={`${athlete.name} を友達から外す`}
            className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <Star className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 pr-3 pl-4 text-[12.5px] text-muted-foreground tabular-nums">
        <StatusPill athlete={athlete} />
        {athlete.lastCheckpointLabel && athlete.lastPassedAt !== null ? (
          <span>
            {athlete.lastCheckpointLabel} 通過 {formatClock(athlete.lastPassedAt)}
          </span>
        ) : (
          <span>まだ計測されていません</span>
        )}
        {athlete.elapsedMs !== null ? <span>· 経過 {formatDuration(athlete.elapsedMs)}</span> : null}
      </div>

      {athlete.status === "not_started" || athlete.status === "dns_suspected" ? null : (
        <div className="mt-2.5 pr-3 pl-4">
          <PositionBar position={athlete.position} finished={finished} nextLabel={nextLabel} />
        </div>
      )}

      <div className="mt-2.5 pr-3 pl-4">
        <DisciplineLines disciplines={athlete.disciplines} />
      </div>

      <div className="mt-2 mb-3 pr-3 pl-4">
        {finished ? (
          <p className="rounded-lg bg-muted px-2.5 py-2 text-[12px] tabular-nums">
            総合{" "}
            <b className="font-bold text-[15px]">
              {athlete.officialTotal ?? formatDuration(athlete.elapsedMs ?? 0)}
            </b>
            {athlete.totalRanks.division ? (
              <>
                {" · 部門 "}
                {athlete.totalRanks.division.rank}/{athlete.totalRanks.division.of}
              </>
            ) : null}
            {athlete.totalRanks.ageGroup ? (
              <>
                {" · エイジ "}
                {athlete.totalRanks.ageGroup.rank}/{athlete.totalRanks.ageGroup.of}
              </>
            ) : null}
          </p>
        ) : (
          <PredictionSummary prediction={athlete.prediction} />
        )}
      </div>
    </article>
  );
}
