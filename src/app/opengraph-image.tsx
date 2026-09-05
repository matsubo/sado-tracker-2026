import { ImageResponse } from "next/og";
import { getRaceConfig } from "@/config/races";
import { raceYear } from "@/lib/runtime/year";

export const runtime = "nodejs";
export const alt = "佐渡トラッカー 2026 — 佐渡国際トライアスロンの応援トラッカー";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SWIM = "#1d4ed8";
const BIKE = "#15803d";
const RUN = "#c2410c";
const INK = "#18181b";
const MUTED = "#71717a";

/**
 * The card people see when the link is shared. It carries the same mark as
 * the icon, three legs with a marker part-way along the run, so a shared link
 * and a browser tab read as the same thing.
 */
export default function OpengraphImage() {
  // The swim can be shortened on the morning of the race, so the card states
  // the distance being swum rather than the one in the entry pack.
  const course = getRaceConfig(raceYear()).divisions.A;
  // The canvas is 1200 wide with 80 of padding each side, so the three bands
  // and the two gaps between them have 1040 to share. The split is the same
  // 22/48/30 the position bar uses.
  const GAP = 12;
  const TRACK = 1200 - 80 * 2 - GAP * 2;
  const bands = [
    { color: SWIM, width: Math.round(TRACK * 0.22), label: "スイム" },
    { color: BIKE, width: Math.round(TRACK * 0.48), label: "バイク" },
    { color: RUN, width: Math.round(TRACK * 0.3), label: "ラン" },
  ];
  // Two thirds along the run: mid-race, not at the finish.
  const markerLeft =
    (bands[0]?.width ?? 0) + (bands[1]?.width ?? 0) + GAP * 2 + (bands[2]?.width ?? 0) * 0.66 - 25;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#ffffff",
        padding: "72px 80px",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
          <span style={{ fontSize: 76, fontWeight: 700, color: INK, letterSpacing: "-0.02em" }}>
            佐渡トラッカー
          </span>
          <span style={{ fontSize: 40, fontWeight: 700, color: MUTED }}>2026</span>
        </div>
        <span style={{ marginTop: 18, fontSize: 34, color: MUTED, lineHeight: 1.45 }}>
          佐渡国際トライアスロンの応援トラッカー
        </span>
        <span style={{ marginTop: 6, fontSize: 30, color: MUTED, lineHeight: 1.45 }}>
          応援している選手の現在地・順位・ゴール予想が、ひと目で。
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: GAP, position: "relative" }}>
          {bands.map((band) => (
            <div
              key={band.label}
              style={{
                width: band.width,
                height: 34,
                borderRadius: 17,
                background: band.color,
                opacity: band.label === "ラン" ? 0.28 : 1,
              }}
            />
          ))}
          <div
            style={{
              position: "absolute",
              left: markerLeft,
              top: -8,
              width: 50,
              height: 50,
              borderRadius: 25,
              background: "#ffffff",
              border: `9px solid ${INK}`,
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 44, fontSize: 28, color: MUTED }}>
          <span>スイム {course.swimKm}km</span>
          <span>バイク {course.bikeKm}km</span>
          <span>ラン {course.runKm}km</span>
          <span style={{ marginLeft: "auto", color: INK, fontWeight: 700 }}>9月6日</span>
        </div>
      </div>
    </div>,
    size,
  );
}
