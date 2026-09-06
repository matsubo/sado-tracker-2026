"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";
import { Suspense, useEffect, useRef } from "react";
import { currentPageTitle } from "@/lib/pageTitle";

/**
 * Google Analytics, with the page view sent by hand.
 *
 * The automatic one fires the moment the address changes, which on a
 * client-side navigation is before React has rendered the new screen, so
 * every page reported the title of the page it came from. Turning it off and
 * sending our own after the title is set files each screen under its own
 * name. The path was always right; only the title was a page behind.
 */
function PageViews({ gaId }: { readonly gaId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (pathname === null) return;
    const query = searchParams?.toString() ?? "";
    const path = query === "" ? pathname : `${pathname}?${query}`;
    if (lastSent.current === path) return;

    // The heading effect that sets the title belongs to a deeper component,
    // so it has already run by the time this one does. A frame of slack
    // covers the case where the page has not painted its heading yet.
    const timer = requestAnimationFrame(() => {
      const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
      if (typeof gtag !== "function") return;
      lastSent.current = path;
      gtag("event", "page_view", {
        page_title: currentPageTitle(),
        page_location: window.location.href,
        page_path: path,
      });
    });
    return () => cancelAnimationFrame(timer);
  }, [pathname, searchParams]);

  return null;
}

export function Analytics({ gaId }: { readonly gaId: string }) {
  return (
    <>
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gaId}', { send_page_view: false });`}
      </Script>
      <Script
        id="ga-src"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
      />
      {/* useSearchParams needs a boundary or the whole tree opts out of static. */}
      <Suspense fallback={null}>
        <PageViews gaId={gaId} />
      </Suspense>
    </>
  );
}
