import type { MetadataRoute } from "next";

/**
 * Enough for the page to be added to a phone's home screen and open without
 * browser chrome, which is how a supporter watches a race for a whole day.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "佐渡トラッカー 2026",
    short_name: "佐渡トラッカー",
    description:
      "佐渡国際トライアスロンの応援トラッカー。ブックマークした選手の現在地、順位、ゴール予想タイムがひと目でわかります。",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "ja",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
