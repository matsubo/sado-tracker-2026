import type { Metadata } from "next";
import { Suspense } from "react";
import { Leaderboard } from "@/components/tracker/Leaderboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "総合トップ" };

export default function HomePage() {
  // The leaderboard reads the division, page and filter out of the address
  // bar, and useSearchParams needs a boundary to read them behind.
  return (
    <Suspense fallback={null}>
      <Leaderboard />
    </Suspense>
  );
}
