import { ImageResponse } from "next/og";
import { COURSE_SHARES, DISCIPLINE_LABELS, DISCIPLINES, getRaceConfig } from "@/config/races";
import { EDITION_YEAR, SITE_NAME, SITE_SHORT_NAME } from "@/config/site";
import { formatMonthDay } from "@/lib/format";
import { raceYear } from "@/lib/runtime/year";

export const runtime = "nodejs";
export const alt = `${SITE_NAME} — 佐渡国際トライアスロンの応援トラッカー`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const LEG_COLOR = { swim: "#1d4ed8", bike: "#15803d", run: "#c2410c" } as const;
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
  const config = getRaceConfig(raceYear());
  const course = config.divisions.A;
  // The canvas is 1200 wide with 80 of padding each side, so the three bands
  // and the two gaps between them have 1040 to share. The split is the one
  // every course strip uses.
  const GAP = 12;
  const TRACK = 1200 - 80 * 2 - GAP * 2;
  const bands = DISCIPLINES.map((discipline) => ({
    discipline,
    color: LEG_COLOR[discipline],
    width: Math.round(TRACK * COURSE_SHARES[discipline]),
    label: DISCIPLINE_LABELS[discipline],
  }));
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
            {SITE_SHORT_NAME}
          </span>
          <span style={{ fontSize: 40, fontWeight: 700, color: MUTED }}>{EDITION_YEAR}</span>
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
                opacity: band.discipline === "run" ? 0.28 : 1,
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
          <span>
            {DISCIPLINE_LABELS.swim} {course.swimKm}km
          </span>
          <span>
            {DISCIPLINE_LABELS.bike} {course.bikeKm}km
          </span>
          <span>
            {DISCIPLINE_LABELS.run} {course.runKm}km
          </span>
          <span style={{ marginLeft: "auto", color: INK, fontWeight: 700 }}>
            {formatMonthDay(config.raceDate)}
          </span>
        </div>
      </div>
    </div>,
    size,
  );
}
