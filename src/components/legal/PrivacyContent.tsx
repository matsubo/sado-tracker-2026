"use client";

import Link from "next/link";
import { CONTACT_URL, OFFICIAL_URL } from "@/components/layout/navLinks";
import { PageHeader } from "@/components/layout/PageHeader";
import { External, Question, Section } from "@/components/layout/Prose";
import { useRaceState } from "@/hooks/useSnapshot";

const GA_OPT_OUT = "https://tools.google.com/dlpage/gaoptout";
const GOOGLE_POLICY = "https://policies.google.com/privacy";

/**
 * What leaves the reader's browser, and what does not.
 *
 * Every claim here is one the source can be checked against: the four
 * localStorage keys, the analytics tag, the webfont import in globals.css.
 * Anything the deployment decides rather than the code — how long a log is
 * kept, what the host records — is left unsaid rather than guessed at.
 */
export function PrivacyContent() {
  const { race, lastPolledAt, error, intervalMs, auto, setAuto, refresh } = useRaceState();

  return (
    <>
      <PageHeader
        title="プライバシーポリシー"
        race={race}
        lastPolledAt={lastPolledAt}
        error={error}
        intervalMs={intervalMs}
        auto={auto}
        onAutoChange={setAuto}
        onRefresh={refresh}
      />

      <Section title="このページについて">
        <p>
          佐渡トラッカーは、佐渡国際トライアスロンを応援する人のための非公式サイトです。
          個人が趣味で運営しています。 このページは、サイトを見たときに何がどこへ送られるのかを、
          実際のソースコードで確かめられる範囲だけ書いたものです。
        </p>
        <p>
          会員登録はありません。名前もメールアドレスも聞いていませんし、
          入力する欄そのものがありません。
        </p>
      </Section>

      <Section title="ブラウザの中だけに残るもの">
        <p>
          次の 4 つは、お使いのブラウザの保存領域に置いているだけで、
          <b className="text-foreground">サーバーには送っていません</b>。
        </p>
        <ul className="flex list-none flex-col gap-1.5 p-0">
          <li>・ブックマークした選手のゼッケン番号</li>
          <li>・通知をどこまで読んだか</li>
          <li>・自動更新を使うかどうか</li>
          <li>・画面を明るくするか暗くするか</li>
        </ul>
        <p>
          誰を応援しているかがこのサイトの外に出ることはありません。
          そのぶん、別の端末や別のブラウザには引き継がれず、
          ブラウザの閲覧データを消すと一緒に消えます。
        </p>
      </Section>

      <Section title="外部に送られるもの">
        <Question q="アクセス解析（Google アナリティクス）">
          <p>
            どのページがどれくらい見られたかを数えるために、Google アナリティクス 4
            を使っています。Google に渡るのは、見たページのアドレスとタイトル、
            どこから来たか、ブラウザ・OS・画面サイズといった一般的な情報、 そして通信元の IP
            アドレスです。
          </p>
          <p>
            この仕組みは <b className="text-foreground">Cookie</b> を使います。同じ人の 2
            回目の訪問をひとまとまりとして数えるためのもので、 氏名などと結び付けてはいません。
            ブックマークした選手や、検索した名前は送っていません。
          </p>
          <p>
            送りたくない場合は、ブラウザの Cookie 設定で拒否するか、Google が配布している{" "}
            <External href={GA_OPT_OUT}>オプトアウト アドオン</External>{" "}
            を使ってください。集計された数字だけが見えるようになるサイトなので、
            止めても表示は何も変わりません。 Google 側の扱いについては{" "}
            <External href={GOOGLE_POLICY}>Google のプライバシー ポリシー</External>{" "}
            をご覧ください。
          </p>
        </Question>
        <Question q="書体（Google Fonts）">
          <p>
            画面の文字は Google Fonts から読み込んでいます。ページを開くたびに Google
            のサーバーへ書体の取得要求が出るため、 ここでも通信元の IP アドレスとブラウザの種類が
            Google に渡ります。
          </p>
        </Question>
        <p className="text-[12px] opacity-90">
          この 2 つが、閲覧者の端末から外部に出る通信のすべてです。
          広告や、行動を追跡する仕組みは入れていません。
        </p>
      </Section>

      <Section title="サーバーが取りに行くもの">
        <p>
          記録は <External href={OFFICIAL_URL}>systemway.jp</External>{" "}
          が公開しているものを、天気は気象庁と Open-Meteo のデータを使っています。いずれも
          <b className="text-foreground">このサイトのサーバーが代表して取得</b>
          していて、閲覧者の端末がこれらに直接つなぐことはありません。
          何人が同時に見ても、計測サイトへのアクセスは増えません。
        </p>
      </Section>

      <Section title="選手の情報の掲載について">
        <p>
          このサイトは、公式の計測サイトがすでに公開している内容
          ——氏名、ゼッケン番号、性別、年代区分、各計測点の通過記録——
          をそのまま読み取って表示しています。 過去大会（2022
          年以降）の結果も、氏名で照合して同じ選手のページに並べています。
        </p>
        <p>
          このサイトが独自に集めた情報は一つもなく、
          公開されていない情報を推測して足すこともしていません。
          順位・コース上の位置・ゴール予想は、公開記録から計算した推定値です。
        </p>
        <p>
          <b className="text-foreground">掲載を望まない場合</b>
          は、下記の連絡先からお知らせください。確認のうえ、 このサイトでの掲載を取りやめます。
          公式の計測サイト側の掲載は、そちらへ直接お問い合わせください。
        </p>
      </Section>

      <Section title="お問い合わせ">
        <p>掲載の取りやめ、このページの内容についての質問は、Discord で受け付けています。</p>
        <ul className="flex list-none flex-col gap-1.5 p-0">
          <li>
            連絡先: <External href={CONTACT_URL}>Discord</External>
          </li>
        </ul>
      </Section>

      <Section title="改定">
        <p>
          内容を変えたときは、このページを書き換えます。
          サイトの作りが変われば、送られるものも変わるためです。
        </p>
        <p className="opacity-80">最終更新: 2026 年 9 月 7 日</p>
      </Section>

      <div className="flex flex-col gap-1.5 px-4 pt-6">
        <Link
          href="/terms"
          className="rounded font-semibold text-[12.5px] text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          利用規約
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
