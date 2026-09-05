import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DivisionRankings } from "@/components/tracker/DivisionRankings";
import type { Division } from "@/config/races";

const DIVISIONS: readonly Division[] = ["A", "B", "RA", "RB"];

type SearchParams = { [key: string]: string | string[] | undefined };

interface PageProps {
  readonly params: Promise<{ div: string }>;
  readonly searchParams: Promise<SearchParams>;
}

/** The route segment is case-insensitive; anything else is a 404. */
function toDivision(raw: string): Division | null {
  const upper = raw.toUpperCase();
  return DIVISIONS.find((division) => division === upper) ?? null;
}

/** Search params arrive as string or string[]; only the first value is used. */
function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { div } = await params;
  const division = toDivision(div);
  return {
    title: division
      ? `${division}タイプ 種目別順位 | 佐渡トラッカー 2026`
      : "ランキング | 佐渡トラッカー 2026",
  };
}

/**
 * Division ranking page. The shell only validates the route and reads the
 * initial view out of the query string, so a shared link opens on the same
 * discipline, age group and page the sender was looking at.
 */
export default async function DivisionPage({ params, searchParams }: PageProps) {
  const { div } = await params;
  const division = toDivision(div);
  if (!division) notFound();

  const query = await searchParams;
  const page = Number(first(query.page) ?? "1");

  return (
    <main className="mx-auto w-full max-w-[480px] pb-10">
      <DivisionRankings
        division={division}
        initialDiscipline={first(query.discipline)}
        initialAgeGroup={first(query.ageGroup)}
        initialBib={first(query.bib)}
        initialPage={Number.isFinite(page) && page >= 1 ? Math.trunc(page) : 1}
      />
    </main>
  );
}
