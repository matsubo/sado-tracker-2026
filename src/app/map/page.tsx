import type { Metadata } from "next";
import { FieldMap } from "@/components/tracker/FieldMap";
import type { Division } from "@/config/races";

const DIVISIONS: readonly Division[] = ["A", "B", "RA", "RB"];

type SearchParams = { [key: string]: string | string[] | undefined };

interface PageProps {
  readonly searchParams: Promise<SearchParams>;
}

export const metadata: Metadata = { title: "全体マップ | 佐渡トラッカー 2026" };

/** Search params arrive as string or string[]; only the first value is used. */
function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * Whole-field map. The shell only reads which division to open on, so a
 * shared link lands on the same view; everything else is live client state.
 */
export default async function MapPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const requested = (first(query.div) ?? "").toUpperCase();
  const division = DIVISIONS.find((id) => id === requested) ?? "A";

  return (
    <main className="mx-auto w-full max-w-[480px] pb-10">
      <FieldMap initialDivision={division} />
    </main>
  );
}
