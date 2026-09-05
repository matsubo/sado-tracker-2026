import type { Metadata } from "next";
import { AthleteDetail } from "@/components/tracker/AthleteDetail";

interface AthletePageProps {
  readonly params: Promise<{ bib: string }>;
}

export async function generateMetadata({ params }: AthletePageProps): Promise<Metadata> {
  const { bib } = await params;
  return { title: `ゼッケン ${bib} | 佐渡トラッカー 2026` };
}

/** Athlete detail. The body is a client component: everything on it is live. */
export default async function AthletePage({ params }: AthletePageProps): Promise<React.JSX.Element> {
  const { bib } = await params;
  return <AthleteDetail bib={bib} />;
}
