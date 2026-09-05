import Link from "next/link";
import { cn } from "@/lib/utils/cn";

const AI_TRI_URL = "https://ai-triathlon-result.teraren.com/";
const SYSTEMWAY_URL = "https://systemway.jp/26sado?di=1";
const REPO_URL = "https://github.com/matsubo/sado-tracker-2026";

const LINK_CLASS = cn(
  "rounded-sm font-semibold text-primary outline-none hover:underline",
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);

/** Site-wide credit line, plus the two places a reader may need to reach. */
export function Footer({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "border-border border-t px-4 pt-3.5 pb-4 text-center text-[11px] text-muted-foreground",
        className,
      )}
    >
      {"Powered by "}
      <a className={LINK_CLASS} href={AI_TRI_URL} target="_blank" rel="noopener noreferrer">
        AI TRI+
      </a>
      {" · 計測データ: "}
      <a className={LINK_CLASS} href={SYSTEMWAY_URL} target="_blank" rel="noopener noreferrer">
        systemway.jp
      </a>
      <span className="mt-1.5 block">
        <Link className={LINK_CLASS} href="/help">
          ヘルプ・FAQ
        </Link>
        {" · "}
        <a className={LINK_CLASS} href={REPO_URL} target="_blank" rel="noopener noreferrer">
          不具合の報告
        </a>
      </span>
    </footer>
  );
}
