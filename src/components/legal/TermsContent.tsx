"use client";

import Link from "next/link";
import { CONTACT_URL, OFFICIAL_URL } from "@/components/layout/navLinks";
import { PageHeader } from "@/components/layout/PageHeader";
import { External, Question, Section } from "@/components/layout/Prose";
import { useRaceState } from "@/hooks/useSnapshot";
import { SITE_NAME } from "@/lib/pageTitle";

const REPO = "https://github.com/matsubo/sado-tracker-2026";

/**
 * The terms, kept to what this site actually is: an unofficial reading of
 * someone else's published record, offered for nothing and guaranteeing
 * nothing. The copyright and warranty clauses restate LICENSE in Japanese so
 * a reader who never opens the repository still sees them.
 */
export function TermsContent() {
  const { race, lastPolledAt, error, intervalMs, auto, setAuto, refresh } = useRaceState();

  return (
    <>
      <PageHeader
        title="利用規約"
        race={race}
        lastPolledAt={lastPolledAt}
        error={error}
        intervalMs={intervalMs}
        auto={auto}
        onAutoChange={setAuto}
        onRefresh={refresh}
      />

      <Section title="はじめに">
        <p>
          この規約は、{SITE_NAME}
          （以下「本サイト」）を使うときの約束ごとです。本サイトを見た時点で、
          これに同意したものとして扱います。
        </p>
      </Section>

      <Section title="本サイトの立場">
        <Question q="公式サイトではありません">
          <p>
            本サイトは <b className="text-foreground">非公式</b>{" "}
            の応援用ツールです。大会の主催者、計測を担当する会社、
            関係する団体のいずれとも関係がなく、後援も許諾も受けていません。
            本サイトについてのお問い合わせを、これらの団体にしないでください。
          </p>
        </Question>
        <Question q="公式記録ではありません">
          <p>
            表示している通過記録は <External href={OFFICIAL_URL}>systemway.jp</External>{" "}
            が公開しているものですが、順位、コース上の位置、ゴール予想時刻は 本サイトが計算した
            <b className="text-foreground">推定値</b>です。
            計算の方法と、実測でどれくらい外れるかはヘルプに書いています。
          </p>
          <p>
            記録の正誤について判断が必要な場面では、必ず公式の発表を確認してください。
            本サイトの表示は、いかなる意味でも公式記録に優先しません。
          </p>
        </Question>
      </Section>

      <Section title="免責">
        <p>
          本サイトは<b className="text-foreground">現状のまま</b>
          提供され、内容の正確性、完全性、いつでも使えることについて、
          明示にも黙示にも保証しません。
          計測サイト側の更新の遅れ、通信の不調、計算の誤りなどにより、
          事実と異なる表示になることがあります。
        </p>
        <p>
          本サイトの利用またはその結果として生じた損害について、運営者は責任を負いません。
          応援に行く場所や時刻の判断に使う場合は、 推定に幅があることを承知のうえでお使いください。
        </p>
        <p>予告なく、内容の変更、表示の停止、サイトそのものの終了を行うことがあります。</p>
      </Section>

      <Section title="やめてほしいこと">
        <p>
          本サイトの <code className="rounded bg-muted px-1 py-px text-[11.5px]">/api/</code>{" "}
          以下のエンドポイントへ、プログラムから繰り返しアクセスすることはご遠慮ください。
          データを計測サイトから取得しているのはおよそ 1 分に 1 回で、
          何人が画面を開いても増えない作りにしています。
          自動アクセスはその前提を崩し、負荷が計測サイトにも及びます。
          記録がまとまった形で必要な場合は、下記からご相談ください。
        </p>
        <p>
          そのほか、法令に反する使い方、他の閲覧者や選手の迷惑になる使い方、
          本サイトの表示を公式記録であるかのように見せる使い方は、おやめください。
        </p>
      </Section>

      <Section title="著作権">
        <p>
          本サイトの画面、文章、プログラムの著作権は運営者に帰属します。
          ソースコードは読めるように公開していますが、 公開は利用許諾ではありません。 条件は{" "}
          <External href={REPO}>リポジトリの LICENSE</External> をご覧ください。
        </p>
        <p>
          本サイトが表示している<b className="text-foreground">計測データ</b>
          の権利は、それぞれの権利者に帰属します。上の記述はこれには及びません。
        </p>
      </Section>

      <Section title="規約の変更">
        <p>
          必要に応じてこの規約を変更することがあります。
          変更後の規約は、このページに掲載した時点から適用されます。
        </p>
      </Section>

      <Section title="準拠法">
        <p>本規約は日本法に準拠して解釈されます。</p>
      </Section>

      <Section title="お問い合わせ">
        <ul className="flex list-none flex-col gap-1.5 p-0">
          <li>
            連絡先: <External href={CONTACT_URL}>Discord</External>
          </li>
          <li>
            不具合の報告: <External href={`${REPO}/issues`}>GitHub Issues</External>
          </li>
        </ul>
        <p className="opacity-80">制定: 2026 年 9 月 7 日</p>
      </Section>

      <div className="flex flex-col gap-1.5 px-4 pt-6">
        <Link
          href="/privacy"
          className="rounded font-semibold text-[12.5px] text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          プライバシーポリシー
        </Link>
        <Link
          href="/"
          className="rounded font-semibold text-[12.5px] text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ‹ 総合トップにもどる
        </Link>
      </div>
    </>
  );
}
