import type { Metadata } from "next";
import { HomeDashboard } from "@/components/tracker/HomeDashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "友達一覧 | 佐渡トラッカー 2026",
  description: "応援している選手の現在地、順位、予想ゴールタイムをまとめて見る。",
};

export default function FriendsPage() {
  return <HomeDashboard />;
}
