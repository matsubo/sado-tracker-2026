"use client";

import Link from "next/link";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Discipline, Division } from "@/config/races";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useLiveClock } from "@/hooks/useLivePosition";
import { useLiveResource, useRaceState } from "@/hooks/useSnapshot";
import type { AthleteDetailDto, RankDto } from "@/lib/api/contract";
import { formatClock, formatClockShort, formatDuration } from "@/lib/format";
import { CoursePositionChart } from "./CoursePositionChart";
import { DisciplineTable } from "./DisciplineTable";
import { LiveStatusBar } from "./LiveStatusBar";
import { PastResults } from "./PastResults";
import { type DisciplineKm, liveKm, PositionBar } from "./PositionBar";
import { PredictionBox } from "./PredictionBox";
import { RankChart } from "./RankChart";
import { SplitTable } from "./SplitTable";

/** Division labels are not on the wire, only the division code. */
const DIVISION_LABELS: Record<Division, string> = {
  A: "Aタイプ",
  B: "Bタイプ",
  RA: "RAタイプ（リレー）",
  RB: "RBタイプ（リレー）",
};

const DISCIPLINE_PILL: Record<Discipline, { label: string; variant: BadgeProps["variant"] }> = {
  swim: { label: "スイム中", variant: "swim" },
  bike: { label: "バイク中", variant: "bike" },
  run: { label: "ラン中", variant: "run" },
};

/** The one-word answer to "how is my friend doing right now?". */
function statusPill(detail: AthleteDetailDto): { label: string; variant: BadgeProps["variant"] } {
  switch (detail.status) {
    case "finished":
      return { label: "フィニッシュ", variant: "secondary" };
    case "dnf":
      return { label: "DNF", variant: "destructive" };
    case "dns_suspected":
      return { label: "未計測", variant: "outline" };
    case "not_started":
      return { label: "スタート前", variant: "outline" };
    default:
      return DISCIPLINE_PILL[detail.position.discipline];
  }
}

/** Section heading with an optional note on the right. */
function Heading({ title, note }: { title: string; note?: string }): React.JSX.Element {
  return (
    <h2 className="mt-4 mb-1.5 flex items-baseline justify-between gap-2 font-bold text-[14px] text-muted-foreground">
      {title}
      {note ? <span className="font-medium text-[11px] tnum">{note}</span> : null}
    </h2>
  );
}

/** One of the three current-rank tiles. */
function RankTile({ label, rank }: { label: string; rank: RankDto | null }): React.JSX.Element {
  return (
    <div className="rounded-lg bg-muted px-2 py-2 text-center">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="font-bold text-[22px] leading-tight tracking-tight tnum">
        {rank === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <>
            <span>{rank.rank}</span>
            <span className="font-semibold text-[12px] text-muted-foreground">/{rank.of}</span>
          </>
        )}
      </div>
    </div>
  );
}

/** Total distance of each leg, taken from the athlete's own discipline rows. */
function disciplineTotals(detail: AthleteDetailDto): DisciplineKm {
  const km = (discipline: Discipline): number =>
    detail.disciplines.find((row) => row.discipline === discipline)?.km ?? 0;
  return { swim: km("swim"), bike: km("bike"), run: km("run") };
}

/** Loading placeholder that keeps the page from jumping when data lands. */
function DetailSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3 px-3 py-4">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

interface AthleteDetailProps {
  readonly bib: string;
}

/** Everything known about one athlete, ordered the way a supporter reads it. */
export function AthleteDetail({ bib }: AthleteDetailProps): React.JSX.Element {
  const { race, fetchedAt, error: raceError, lastPolledAt, intervalMs } = useRaceState();
  const {
    data: detail,
    loading,
    error,
    missing,
  } = useLiveResource<AthleteDetailDto>(`/api/athletes/${bib}`, fetchedAt);
  const { has, add, remove, ready } = useBookmarks();
  const nowMs = useLiveClock();

  if (loading) return <DetailSkeleton />;
  // A failed refresh keeps the last good data; only an empty page is an error.
  if (detail === null) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-[13px] text-muted-foreground">
          {missing
            ? `ゼッケン ${bib} は今年のエントリーに見つかりませんでした。番号をお確かめください。`
            : `ゼッケン ${bib} の情報を表示できませんでした。少し時間をおいて開き直してください。`}
        </p>
        <Link
          href="/friends"
          className="mt-3 inline-block rounded-md px-2 py-1 font-semibold text-[13px] text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ‹ 友達一覧
        </Link>
      </div>
    );
  }

  const pill = statusPill(detail);
  const bookmarked = has(detail.bib);
  const totals = disciplineTotals(detail);
  const checkpoints =
    race?.divisions.find((entry) => entry.id === detail.division)?.checkpoints ?? [];
  const passedIndex = checkpoints.findIndex((cp) => cp.label === detail.lastCheckpointLabel);
  const nextLabel = checkpoints[passedIndex + 1]?.label ?? null;
  const finished = detail.status === "finished";
  const estKm = detail.status === "racing" ? liveKm(detail.position, nowMs) : detail.position.estKm;
  const sexLabel = detail.sex === "F" ? "女子" : detail.sex === "M" ? "男子" : "性別";
  const aiTriHref = detail._links.aiTri?.href ?? null;

  return (
    <div className="mx-auto w-full max-w-[480px] pb-10">
      <LiveStatusBar
        race={race}
        lastPolledAt={lastPolledAt}
        error={raceError}
        intervalMs={intervalMs}
      />
      {error === null ? null : (
        <p role="status" className="px-4 pt-2 text-[11.5px] text-muted-foreground">
          最新の情報を取得できませんでした。表示は直前の内容です。
        </p>
      )}
      <div className="flex items-center justify-between px-4 pt-3 pb-1 text-[13px]">
        <Link
          href="/friends"
          className="rounded-md px-1 py-0.5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          ‹ 友達一覧
        </Link>
        {ready ? (
          <button
            type="button"
            aria-pressed={bookmarked}
            onClick={() => (bookmarked ? remove(detail.bib) : add(detail.bib))}
            className="rounded-md px-1 py-0.5 font-bold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {bookmarked ? "★ 友達に登録済み" : "☆ 友達に登録"}
          </button>
        ) : null}
      </div>

      <div className="px-4 pt-1">
        <h1 className="flex items-baseline gap-2 font-bold text-[24px] leading-tight">
          {detail.name}
          <span className="font-semibold text-[14px] text-muted-foreground tnum">
            #{detail.bib}
          </span>
        </h1>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          {DIVISION_LABELS[detail.division]} · {detail.ageGroupLabel ?? "年齢区分なし"} ·{" "}
          {formatClockShort(detail.startAt)} スタート
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 pt-2 text-[12.5px] text-muted-foreground tnum">
        <Badge variant={pill.variant}>{pill.label}</Badge>
        {detail.lastCheckpointLabel !== null && detail.lastPassedAt !== null ? (
          <span>
            {detail.lastCheckpointLabel} 通過 {formatClock(detail.lastPassedAt)}
          </span>
        ) : null}
        {detail.elapsedMs !== null ? <span>経過 {formatDuration(detail.elapsedMs)}</span> : null}
      </div>

      <div className="px-4 pt-2.5">
        <PositionBar
          discipline={detail.position.discipline}
          estKm={estKm}
          totalKm={detail.position.totalKm}
          waiting={detail.position.waiting}
          finished={finished}
          nextLabel={nextLabel}
        />
      </div>

      <div className="grid grid-cols-3 gap-1.5 px-3 pt-3">
        <RankTile
          label={
            detail.lastCheckpointLabel === null
              ? "部門"
              : `部門 · ${detail.lastCheckpointLabel}時点`
          }
          rank={detail.totalRanks.division}
        />
        <RankTile label={sexLabel} rank={detail.totalRanks.sex} />
        <RankTile
          label={detail.ageGroupLabel === null ? "エイジ" : `エイジ ${detail.ageGroupLabel}`}
          rank={detail.totalRanks.ageGroup}
        />
      </div>

      <div className="px-3">
        <Heading title="種目" note="暫定 = 進行中の区間" />
        <DisciplineTable rows={detail.disciplines} splits={detail.splits} />

        {detail.prediction === null ? null : (
          <>
            <Heading title="予想ゴール" />
            <PredictionBox prediction={detail.prediction} startAt={detail.startAt} />
          </>
        )}

        <Heading title="コース上の位置" note="10 秒ごとに再計算" />
        <CoursePositionChart
          entries={detail.neighbours}
          checkpoints={checkpoints}
          totals={totals}
          nowMs={nowMs}
        />

        <Heading title="順位推移" note={`部門総合 · ${sexLabel} · エイジ`} />
        <div className="rounded-lg border border-border bg-card px-2 py-2">
          <RankChart
            history={detail.rankHistory}
            sexLabel={sexLabel}
            ageGroupLabel={detail.ageGroupLabel}
          />
        </div>

        <Heading title="スプリット" note="区間順位は同区間を計測済みの同部門内" />
        <SplitTable splits={detail.splits} />

        <Heading title="過去の成績" note="同じ名前で検索" />
        <PastResults results={detail.pastResults} />
      </div>

      {aiTriHref === null ? null : (
        <p className="px-4 pt-5 text-[11px] text-muted-foreground">
          別サイトで見る:{" "}
          <a
            href={aiTriHref}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-sm underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            AI TRI+ の選手ページ ↗
          </a>
        </p>
      )}
    </div>
  );
}
