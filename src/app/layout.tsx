import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Analytics } from "@/components/layout/Analytics";
import { Footer } from "@/components/layout/Footer";
import {
  DEFAULT_SITE_URL,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_SHORT_NAME,
  storageKey,
} from "@/config/site";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // Every page sets its own title and it is suffixed here, so analytics can
  // tell the screens apart instead of filing them all under the site name.
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  applicationName: SITE_SHORT_NAME,
  appleWebApp: { capable: true, title: SITE_SHORT_NAME, statusBarStyle: "default" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    // Every page sets its own title and it is suffixed here, so analytics can
    // tell the screens apart instead of filing them all under the site name.
    title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
    description: SITE_DESCRIPTION,
    locale: "ja_JP",
    url: SITE_URL,
  },
  twitter: { card: "summary_large_image", title: SITE_NAME, description: SITE_DESCRIPTION },
  description: SITE_DESCRIPTION,
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
var stored=localStorage.getItem('${storageKey("theme")}');
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
        {GA_ID ? <Analytics gaId={GA_ID} /> : null}
      </body>
    </html>
  );
}
