import type { Metadata } from "next";
import { BookmarkDashboard } from "@/components/tracker/BookmarkDashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ブックマーク",
  description: "ブックマークした選手の現在地、順位、ゴール予想タイムをまとめて見る。",
};

export default function FriendsPage() {
  return <BookmarkDashboard />;
}
