import { GoogleAnalytics } from "@next/third-parties/google";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Footer } from "@/components/layout/Footer";
import "./globals.css";

const DESCRIPTION =
  "佐渡国際トライアスロンの応援トラッカー。ブックマークした選手の現在地、順位、ゴール予想タイムがひと目でわかります。";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sado-tracker-2026.teraren.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "佐渡トラッカー 2026",
  applicationName: "佐渡トラッカー",
  appleWebApp: { capable: true, title: "佐渡トラッカー", statusBarStyle: "default" },
  openGraph: {
    type: "website",
    siteName: "佐渡トラッカー 2026",
    title: "佐渡トラッカー 2026",
    description: DESCRIPTION,
    locale: "ja_JP",
    url: SITE_URL,
  },
  twitter: { card: "summary_large_image", title: "佐渡トラッカー 2026", description: DESCRIPTION },
  description: DESCRIPTION,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Match the page ground so the browser chrome does not flash white in dark mode.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#18181b" },
  ],
};

/**
 * Analytics is opt-in through the environment. Nothing is sent when the id is
 * unset, which is the case for local development and for anyone running their
 * own copy, and no measurement id is baked into a public repository.
 */
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

/** Applies the stored theme before first paint so the page never flashes. */
const THEME_SCRIPT = `(function(){try{
var stored=localStorage.getItem('sado2026.theme');
var dark=stored?stored==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;
document.documentElement.classList.toggle('dark',dark);
}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static script, must run before paint */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <div className="flex min-h-dvh flex-col bg-background text-foreground">
          <div className="flex-1">{children}</div>
          <Footer />
        </div>
        {GA_ID ? <GoogleAnalytics gaId={GA_ID} /> : null}
      </body>
    </html>
  );
}
