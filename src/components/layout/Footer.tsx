import Link from "next/link";
import { NAV_LINKS, OFFICIAL_URL } from "@/components/layout/navLinks";
import { ShareButtons } from "@/components/layout/ShareButtons";
import { cn } from "@/lib/utils/cn";

const AI_TRI_URL = "https://ai-triathlon-result.teraren.com/";
const REPO_URL = "https://github.com/matsubo/sado-tracker-2026";
const AUTHOR_URL = "https://x.com/ittriathlon";

const LINK_CLASS = cn(
  "rounded-sm font-semibold text-primary outline-none hover:underline",
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);

/**
 * The foot of every page: where else to go, how to pass the page on, and who
 * the data belongs to. The destinations are the same list the menu shows,
 * because a reader who reaches the bottom should not have to go back up to
 * find out where else the site goes.
 */
export function Footer({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "border-border border-t px-4 pt-4 pb-5 text-center text-[11px] text-muted-foreground",
        className,
      )}
    >
      <nav aria-label="サイト内のページ">
        <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[12px]">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link className={LINK_CLASS} href={link.href}>
                {link.label}
              </Link>
            </li>
          ))}
          <li>
            <a className={LINK_CLASS} href={OFFICIAL_URL} target="_blank" rel="noopener noreferrer">
              公式計測サイト ↗
            </a>
          </li>
        </ul>
      </nav>

      <ShareButtons
        text="佐渡国際トライアスロンの応援トラッカー"
        source="footer"
        className="mt-3.5"
      />

      <p className="mt-3.5">
        {"Powered by "}
        <a className={LINK_CLASS} href={AI_TRI_URL} target="_blank" rel="noopener noreferrer">
          AI TRI+
        </a>
        {" · 計測データ: "}
        <a className={LINK_CLASS} href={OFFICIAL_URL} target="_blank" rel="noopener noreferrer">
          systemway.jp
        </a>
      </p>

      <p className="mt-1.5">
        <a className={LINK_CLASS} href={REPO_URL} target="_blank" rel="noopener noreferrer">
          不具合の報告・ソースコード
        </a>
        {" · 作者 "}
        <a className={LINK_CLASS} href={AUTHOR_URL} target="_blank" rel="noopener noreferrer">
          @ittriathlon ↗
        </a>
      </p>

      {/* The source is readable, which is not the same as reusable. */}
      <p className="mt-2 text-[10.5px]">© 2026 Yuki Matsukura. All rights reserved.</p>
    </footer>
  );
}
