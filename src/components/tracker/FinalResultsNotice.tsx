import type { RaceStateDto } from "@/lib/api/contract";
import { formatRaceDate } from "@/lib/format";

/**
 * Shown once the race is over, so a reader arriving days later knows the page
 * is a record rather than a live feed that has stalled.
 */
export function FinalResultsNotice({ race }: { race: RaceStateDto | null }) {
  if (race?.finalResults !== true) return null;

  const finished = race.divisions
    .filter((division) => division.entrants > 0)
    .map((division) => `${division.label} ${race.counts[division.id].finish ?? 0} 名`)
    .join(" · ");

  return (
    <section className="rounded-lg border border-border bg-muted/40 px-4 py-3">
      <h2 className="font-bold text-[13.5px]">{race.year} 年大会は終了しました</h2>
      <p className="mt-1 text-[12.5px] text-muted-foreground leading-relaxed">
        以下は最終結果です。完走 {finished}。
      </p>
      <p className="mt-1.5 text-[11.5px] text-muted-foreground">
        {formatRaceDate(race.raceDate)}開催
      </p>
    </section>
  );
}
