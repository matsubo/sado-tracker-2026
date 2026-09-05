import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Footer } from "@/components/layout/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "佐渡トラッカー 2026",
  applicationName: "佐渡トラッカー",
  appleWebApp: { capable: true, title: "佐渡トラッカー", statusBarStyle: "default" },
  description:
    "佐渡国際トライアスロンの応援トラッカー。ブックマークした選手の現在地、順位、ゴール予想タイムがひと目でわかります。",
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
      </body>
    </html>
  );
}
