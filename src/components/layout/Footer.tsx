import Link from "next/link";
import { LEGAL_LINKS, NAV_LINKS, OFFICIAL_URL } from "@/components/layout/navLinks";
import { ShareButtons } from "@/components/layout/ShareButtons";
import { cn } from "@/lib/utils/cn";

const AI_TRI_URL = "https://ai-triathlon-result.teraren.com/";
const REPO_URL = "https://github.com/matsubo/sado-tracker-2026";
const AUTHOR_URL = "https://x.com/ittriathlon";

/** Destinations: quiet until touched, because they are not the point of the page. */
const NAV_LINK = cn(
  "block rounded-sm py-0.5 text-foreground outline-none hover:text-primary hover:underline",
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  "focus-visible:ring-offset-background",
);

/** Credits: an aside, and styled like one. */
const META_LINK = cn(
  "rounded-sm text-muted-foreground underline decoration-border underline-offset-2",
  "outline-none hover:text-foreground hover:decoration-current",
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  "focus-visible:ring-offset-background",
);

/**
 * The foot of every page, in three bands that get quieter going down: where
 * else to go, how to pass the page on, and who the work belongs to.
 *
 * The destinations sit on a fixed grid rather than a wrapping row, which used
 * to leave one item stranded and centred under the other five.
 */
export function Footer({ className }: { className?: string }) {
  return (
    <footer className={cn("mt-6 border-border border-t", className)}>
      <div className="mx-auto w-full max-w-[430px] px-5 pt-5 pb-6">
        <nav aria-label="サイト内のページ">
          <ul className="grid grid-cols-3 gap-x-3 gap-y-0.5 text-[12.5px]">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link className={NAV_LINK} href={link.href}>
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <a className={NAV_LINK} href={OFFICIAL_URL} target="_blank" rel="noopener noreferrer">
                公式計測サイト
                <span aria-hidden className="ml-0.5 text-[10px] text-muted-foreground">
                  ↗
                </span>
              </a>
            </li>
          </ul>
        </nav>

        <div className="mt-5 border-border border-t pt-4">
          <ShareButtons text="佐渡国際トライアスロンの応援トラッカー" source="footer" />
        </div>

        <div className="mt-5 flex flex-col items-center gap-1 text-center text-[11px] text-muted-foreground">
          <p>
            {"Powered by "}
            <a className={META_LINK} href={AI_TRI_URL} target="_blank" rel="noopener noreferrer">
              AI TRI+
            </a>
            {" · 計測データ "}
            <a className={META_LINK} href={OFFICIAL_URL} target="_blank" rel="noopener noreferrer">
              systemway.jp
            </a>
          </p>
          <p>
            <a className={META_LINK} href={REPO_URL} target="_blank" rel="noopener noreferrer">
              不具合の報告・ソースコード
            </a>
            {" · 作者 "}
            <a className={META_LINK} href={AUTHOR_URL} target="_blank" rel="noopener noreferrer">
              @ittriathlon
            </a>
          </p>
          {/* Sought out rather than browsed to, so they sit with the credits
              rather than among the destinations, which the menu also lists. */}
          <p>
            {LEGAL_LINKS.map((link, index) => (
              <span key={link.href}>
                {index > 0 ? " · " : null}
                <Link className={META_LINK} href={link.href}>
                  {link.label}
                </Link>
              </span>
            ))}
          </p>
          {/* The source is readable, which is not the same as reusable. */}
          <p className="mt-0.5 text-[10.5px] opacity-80">
            © 2026 Yuki Matsukura. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
