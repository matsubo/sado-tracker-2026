import type { RaceStateDto } from "@/lib/api/contract";
import { formatClockShort } from "@/lib/format";

/** Shown while every athlete is still waiting for their wave to start. */
export function PreRaceNotice({ race }: { race: RaceStateDto | null }) {
  if (!race) return null;
  const entrants = race.divisions.reduce((sum, division) => sum + division.entrants, 0);
  const racing = race.divisions.reduce((sum, division) => sum + division.racing, 0);
  if (entrants === 0 || racing > 0) return null;

  return (
    <section className="rounded-lg border border-border bg-card px-4 py-3">
      <h2 className="font-bold text-[13.5px]">スタート前です</h2>
      <p className="mt-1 text-[12.5px] text-muted-foreground leading-relaxed">
        {race.year} 年大会のエントリー {entrants.toLocaleString("ja-JP")} 名を読み込みました。
        Aタイプは 06:00、Bタイプは 07:30 にスタートします。
        いまのうちに応援する友達を登録しておくと、通過するたびに通知が出ます。
      </p>
      <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground tabular-nums">
        {race.divisions
          .filter((division) => division.entrants > 0)
          .map((division) => (
            <div key={division.id} className="flex gap-1">
              <dt>{division.label}</dt>
              <dd className="font-semibold text-foreground">{division.entrants} 名</dd>
            </div>
          ))}
      </dl>
      <p className="mt-2 text-[11.5px] text-muted-foreground">
        データ取得: {formatClockShort(race.fetchedAt)}
      </p>
    </section>
  );
}
