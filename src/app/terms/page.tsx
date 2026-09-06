import type { Metadata } from "next";
import { TermsContent } from "@/components/legal/TermsContent";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "利用規約",
  description:
    "非公式サイトであること、表示は推定値であること、免責、著作権と計測データの権利、お問い合わせ先。",
};

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-[480px] pb-10">
      <TermsContent />
    </main>
  );
}
