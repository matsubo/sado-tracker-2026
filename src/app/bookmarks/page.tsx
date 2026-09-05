import type { Metadata } from "next";
import { BookmarkDashboard } from "@/components/tracker/BookmarkDashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ブックマーク | 佐渡トラッカー 2026",
  description: "ブックマークした選手の現在地、順位、予想ゴールタイムをまとめて見る。",
};

export default function FriendsPage() {
  return <BookmarkDashboard />;
}
