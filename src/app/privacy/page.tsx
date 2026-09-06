import type { Metadata } from "next";
import { PrivacyContent } from "@/components/legal/PrivacyContent";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  description:
    "ブラウザの中だけに残るもの、アクセス解析と書体で外部に送られるもの、選手情報の掲載と取りやめの連絡先。",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-[480px] pb-10">
      <PrivacyContent />
    </main>
  );
}
