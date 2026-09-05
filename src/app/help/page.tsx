import type { Metadata } from "next";
import { HelpContent } from "@/components/tracker/HelpContent";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ヘルプ | 佐渡トラッカー 2026",
  description: "データの取得方法、順位や推定位置の決め方、ゴール予想の精度、不具合の報告先。",
};

export default function HelpPage() {
  return (
    <main className="mx-auto w-full max-w-[480px] pb-10">
      <HelpContent />
    </main>
  );
}
