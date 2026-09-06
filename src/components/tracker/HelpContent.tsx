"use client";

import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { External, Question, Section } from "@/components/layout/Prose";
import { useRaceState } from "@/hooks/useSnapshot";
import { waveStartSentence } from "@/lib/format";

const REPO = "https://github.com/matsubo/sado-tracker-2026";
const ISSUES = `${REPO}/issues`;
const SOURCE = "https://systemway.jp/26sado?di=1";
const AI_TRI = "https://ai-triathlon-result.teraren.com/";

/**
 * What the numbers mean and where they come from. A supporter who does not
 * know that a position is estimated, or that a rank counts only the athletes
 * measured so far, will read the screen as more certain than it is.
 */
export function HelpContent() {
  const { race, lastPolledAt, error, intervalMs, auto, setAuto, refresh } = useRaceState();
  const seconds = Math.round((race?.pollIntervalMs ?? 60_000) / 1000);
  const year = race?.year ?? 2026;
  // History is every past race the app can load, which is the year before the
  // one on screen back to 2022.
  const historyTo = year - 1;

  return (
    <>
      <PageHeader
        title="ヘルプ"
        race={race}
        lastPolledAt={lastPolledAt}
        error={error}
        intervalMs={intervalMs}
        auto={auto}
        onAutoChange={setAuto}
        onRefresh={refresh}
      />

      <Section title="このサイトについて">
        <p>
          {year} 年の佐渡国際トライアスロンを応援する人のための、非公式のトラッカーです。
          公式の計測サイトが公開している通過記録を読み取り、順位やコース上の位置、
          ゴール予想時刻を計算して表示しています。大会の主催者や計測会社とは関係ありません。
        </p>
        <p>
          {waveStartSentence(race)}
          スタート前は全員が「スタート前」と表示され、最初の計測点を通過した選手から順に動きはじめます。
        </p>
      </Section>

      <Section title="データの取得">
        <Question q="どこからデータを取っていますか">
          <p>
            計測を担当している <External href={SOURCE}>systemway.jp</External>{" "}
            が公開している記録一覧を、そのまま読み込んでいます。
            このサイトが独自に計測しているものは一つもありません。
          </p>
        </Question>
        <Question q="どれくらいの間隔で更新されますか">
          <p>
            サーバーが <b className="text-foreground">{seconds} 秒</b>{" "}
            ごとに全選手のデータを取得し、順位や推定位置をまとめて計算し直します。
            画面はその更新に合わせて自動で書き換わるので、リロードは不要です。
            画面上部に、レース中の現在時刻と最後にデータを取得した時刻が出ています。
          </p>
          <p>
            計測サイト側の反映に時間がかかることがあります。
            通過したはずの地点がまだ出ていない場合は、次の更新を待ってください。
            取得に失敗したときは直前の内容を表示したまま「再取得中」と出し、
            古い数字を新しいもののように見せることはしません。
          </p>
        </Question>
        <Question q="ページを開くたびに取りに行っているのですか">
          <p>
            いいえ。取得はサーバーが一括で行い、結果を全員で共有しています。
            何人が同時に見ても、計測サイトへのアクセスは {seconds} 秒に 1 回のままです。
          </p>
        </Question>
        <Question q="自動更新を止められますか">
          <p>
            画面上部の「自動更新」のチェックを外すと、勝手に書き換わらなくなります。
            表を読んでいる途中で並びが変わるのが煩わしいときに使ってください。
            隣の秒数を押せば、そのときだけ手動で更新できます。設定はこのブラウザに残ります。
          </p>
        </Question>
        <Question q="いつ取得していますか">
          <p>
            大会当日の 7 時から 23 時までです。 この時間の外では計測サイトに問い合わせません。
            レース前後に読み込んでも記録は増えないので、
            他所のサーバーに無用な負荷をかけないためです。
          </p>
          <p>時間外でも画面は開けます。最後に取得した内容をそのまま表示します。</p>
        </Question>
      </Section>

      <Section title="順位の見方">
        <Question q="「総合」「男子」「エイジ」は何と比べた順位ですか">
          <p>
            どれも同じタイプの中の順位で、比べる相手の範囲だけが違います。
            「総合」はそのタイプの全員、男女も年代もまとめた順位です。
            「男子」「女子」は同じ性別の中、「エイジ」は同じ性別で同じ年代区分の中の順位です。
          </p>
          <p>
            たとえば A タイプの男子 30-34 歳の選手なら、総合はエントリー全員、
            男子は女子を除いた人数、エイジは 30-34 歳男子だけが分母になります。 狭い順に
            エイジ、男子・女子、総合 です。
          </p>
        </Question>
        <Question q="順位の分母が種目ごとに違うのはなぜですか">
          <p>
            レース中の順位は「その計測点を通過した人の中での順位」です。
            まだ通過していない人は数えようがないので分母に入りません。
            分母は必ず併記しているので、201/412 なら 「その地点を通過した 412 人のうち 201
            番目」という意味です。 人数は時間とともに増え、順位も動きます。
          </p>
        </Question>
        <Question q="「暫定」とは何ですか">
          <p>
            その種目がまだ終わっていないという意味です。
            たとえばバイクの途中なら、そこまでの区間タイムで順位を出しています。
            種目を走り切った人だけの順位に切り替わるのは、その選手がゴール地点を通過してからです。
          </p>
        </Question>
        <Question q="タイプをまたいだ順位は出ますか">
          <p>
            出しません。A・B・RA・RB は距離が違うので比較できません。
            順位はすべて同じタイプの中だけで計算しています。
          </p>
        </Question>
      </Section>

      <Section title="推定と予想">
        <Question q="コース上の位置はどうやって出していますか">
          <p>
            計測点は要所にしかないので、最後に通過した地点から、
            その選手の直近の速度で進んだ距離を足しています。
            自分の速度がまだ分からない区間では、同じタイプの選手の中央値を使います。
          </p>
          <p>
            次の計測点は超えないように止めています。超えていれば記録が出ているはずだからです。
            止まっている表示は「その区間のどこかにいるが、正確な位置は次の計測待ち」という意味です。
            画面では、計測された値と推定された値を別の枠に分けて表示しています。
          </p>
        </Question>
        <Question q="ゴール予想はどれくらい当たりますか">
          <p>
            過去の完走者から、同じ地点での走り方が近い 20 人を選び、
            その人たちが残りにかけた時間の中央値を足しています。
            精度は地点によって大きく違い、各選手のページの「?」ボタンを押すと、
            その地点での実測の誤差が出ます。
          </p>
          <p>
            目安として、バイク中盤の予想は誤差の中央値が 25 分前後、 ラン 30km 地点では 5
            分未満です。序盤の予想は幅として読んでください。
          </p>
        </Question>
      </Section>

      <Section title="ブックマークと通知">
        <Question q="ブックマークはどこに保存されますか">
          <p>
            お使いのブラウザの中だけです。サーバーには送っていません。
            誰を応援しているかが外に出ることはありません。
            そのぶん、別の端末やブラウザには引き継がれません。
          </p>
        </Question>
        <Question q="アクセス解析はしていますか">
          <p>
            どのページがどれくらい見られたかを Google アナリティクスで数えています。
            送っているのは閲覧したページと、ブラウザや画面サイズといった一般的な情報だけです。
            ブックマークの一覧、つまり誰を応援しているかは送っていません。
          </p>
          <p>
            何がどこへ送られるかは{" "}
            <Link
              href="/privacy"
              className="rounded font-semibold text-primary underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              プライバシーポリシー
            </Link>{" "}
            に書いています。
          </p>
        </Question>
        <Question q="通知は届きますか">
          <p>
            画面を開いている間だけです。ヘッダーのベルに、
            ブックマークした選手が計測点を通過した記録が新しい順に並びます。
            既読かどうかもブラウザの中で管理しています。
            アプリの通知のように、閉じている間に届くものではありません。
          </p>
        </Question>
      </Section>

      <Section title="見つからないとき">
        <Question q="選手が検索に出てきません">
          <p>
            名前は公式の記録一覧の表記をそのまま使っています。
            姓だけ、あるいはゼッケン番号で探すと見つかりやすいです。
            エントリーしていない年の選手は出ません。
          </p>
        </Question>
        <Question q="過去の成績が出ません">
          <p>
            2022 年から {historyTo} 年の記録を名前で照合しています。
            表記が変わっていたり、同姓同名が複数いる場合は正しく結び付かないことがあります。
            同姓同名は該当するものをすべて表示します。
          </p>
        </Question>
      </Section>

      <Section title="不具合の報告と開発">
        <p>
          数字がおかしい、表示が崩れる、こういう機能が欲しい。
          どれも歓迎します。気づいたことがあれば、こちらに書いてください。
        </p>
        <ul className="flex list-none flex-col gap-1.5 p-0">
          <li>
            不具合の報告・要望: <External href={ISSUES}>GitHub Issues</External>
          </li>
          <li>
            ソースコード: <External href={REPO}>matsubo/sado-tracker-2026</External>
          </li>
        </ul>
        <p>リポジトリは公開しています。修正の提案も受け付けています。</p>
      </Section>

      <Section title="関連">
        <ul className="flex list-none flex-col gap-1.5 p-0">
          <li>
            公式の計測記録: <External href={SOURCE}>systemway.jp</External>
          </li>
          <li>
            過去大会の分析: <External href={AI_TRI}>AI TRI+</External>
          </li>
        </ul>
      </Section>

      <div className="px-4 pt-6">
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
