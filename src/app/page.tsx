import type { Metadata } from "next";
import { Leaderboard } from "@/components/tracker/Leaderboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "総合トップ" };

export default function HomePage() {
  return <Leaderboard />;
}
