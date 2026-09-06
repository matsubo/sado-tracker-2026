"use client";

import { Check, Link2 } from "lucide-react";
import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import { type ShareNetwork, shareHref, shareUrl } from "@/lib/share";
import { cn } from "@/lib/utils/cn";

interface Props {
  /** What the shared post says. The link is added by the network. */
  readonly text: string;
  /** Which screen the share came from, for the event only. */
  readonly source: string;
  /** Small line above the icons; omitted when the context is already clear. */
  readonly caption?: string | null;
  readonly className?: string;
}

/** Brand marks, drawn here because the icon set carries no logos. */
function XMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-[15px]">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function FacebookMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-[15px]">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.412c0-3.025 1.792-4.695 4.533-4.695 1.313 0 2.686.235 2.686.235v2.968H15.83c-1.491 0-1.956.93-1.956 1.887v2.266h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073" />
    </svg>
  );
}

function LineMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-[15px]">
      <path d="M24 10.304c0-5.369-5.383-9.738-12-9.738S0 4.935 0 10.304c0 4.814 4.269 8.846 10.036 9.608.39.084.923.258 1.058.592.122.303.08.778.039 1.084l-.171 1.027c-.053.303-.242 1.186 1.038.647 1.28-.54 6.911-4.069 9.428-6.967C23.176 14.393 24 12.454 24 10.304M7.29 13.51H4.907a.63.63 0 0 1-.63-.63V8.115a.63.63 0 0 1 1.26 0v4.135H7.29a.63.63 0 0 1 0 1.26m2.467-.63a.63.63 0 0 1-1.26 0V8.115a.63.63 0 0 1 1.26 0zm5.583 0a.63.63 0 0 1-1.134.378l-2.443-3.324v2.946a.63.63 0 0 1-1.26 0V8.115a.63.63 0 0 1 1.134-.378l2.443 3.325V8.115a.63.63 0 0 1 1.26 0zm3.755-3.012a.63.63 0 0 1 0 1.26h-1.752v1.122h1.752a.63.63 0 0 1 0 1.26h-2.382a.63.63 0 0 1-.63-.63V8.115a.63.63 0 0 1 .63-.63h2.382a.63.63 0 0 1 0 1.26h-1.752v1.122z" />
    </svg>
  );
}

const NETWORKS: readonly {
  id: ShareNetwork;
  label: string;
  Mark: () => React.JSX.Element;
  tone: string;
}[] = [
  {
    id: "x",
    label: "X",
    Mark: XMark,
    tone: "hover:border-foreground hover:bg-foreground hover:text-background",
  },
  {
    id: "facebook",
    label: "Facebook",
    Mark: FacebookMark,
    tone: "hover:border-[#1877f2] hover:bg-[#1877f2] hover:text-white",
  },
  {
    id: "line",
    label: "LINE",
    Mark: LineMark,
    tone: "hover:border-[#06c755] hover:bg-[#06c755] hover:text-white",
  },
];

/**
 * Icon only, and the same circle for each.
 *
 * Labelled pills were three different widths, wrapped on a phone and left the
 * fourth stranded on a line of its own, which made four small actions look
 * like the most important thing in the footer. The mark alone is what people
 * scan for, and the accessible name carries the rest.
 */
const BUTTON = cn(
  "grid size-9 place-items-center rounded-full border border-border bg-card",
  "text-muted-foreground transition-colors duration-150",
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  "focus-visible:ring-offset-background",
);

/**
 * Send this page to the people who would want it. The address is rebuilt from
 * the origin and path, so a bookmark list that arrived as `?bibs=` is never
 * handed on: who someone is following is theirs.
 */
export function ShareButtons({ text, source, caption = "共有", className }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // The address is only known in the browser, and rendering it on the server
  // would mean shipping a link to a page nobody asked for.
  useEffect(() => setUrl(shareUrl(window.location.href)), []);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async (): Promise<void> => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      track("share", { source, network: "clipboard" });
    } catch {
      // A browser that refuses the clipboard still has the three links.
    }
  };

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      {caption ? (
        <span className="text-[10.5px] text-muted-foreground uppercase tracking-[0.14em]">
          {caption}
        </span>
      ) : null}
      <div className="flex items-center gap-2">
        {NETWORKS.map(({ id, label, Mark, tone }) => (
          <a
            key={id}
            href={url ? shareHref(id, url, text) : undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${label} で共有`}
            onClick={() => track("share", { source, network: id })}
            className={cn(BUTTON, tone, !url && "pointer-events-none opacity-50")}
          >
            <Mark />
          </a>
        ))}
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "リンクをコピーしました" : "リンクをコピー"}
          className={cn(
            BUTTON,
            copied
              ? "border-[color:var(--run)] text-[color:var(--run)]"
              : "hover:border-foreground hover:text-foreground",
          )}
        >
          {copied ? (
            <Check className="size-[15px]" aria-hidden />
          ) : (
            <Link2 className="size-[15px]" aria-hidden />
          )}
        </button>
      </div>
    </div>
  );
}
