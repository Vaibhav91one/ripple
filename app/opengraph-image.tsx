import { ImageResponse } from "next/og";

export const alt = "Ripple: the change-impact graph for your company";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Renders outside the app CSS, so the two brand colours are literal here (same as app/icon.svg).
const TEAL = "#5EEAD4";
const AMBER = "#FBBF24";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 72, padding: 96, background: "#0b0b0b", color: "#f5f5f5" }}>
        <svg width="320" height="320" viewBox="0 0 32 32" fill="none" strokeWidth="2.6" strokeLinecap="round">
          <g stroke={TEAL}>
            <circle cx="6" cy="26" r="3" fill={TEAL} stroke="none" />
            <path d="M13 26 A7 7 0 0 0 6 19" opacity=".9" />
            <path d="M19 26 A13 13 0 0 0 6 13" opacity=".65" />
          </g>
          <g stroke={AMBER}>
            <path d="M25 26 A19 19 0 0 0 21.56 15.1" />
            <path d="M16.9 10.44 A19 19 0 0 0 6 7" />
          </g>
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 104, fontWeight: 600, letterSpacing: -3 }}>Ripple</div>
          <div style={{ fontSize: 38, color: "#a3a3a3", lineHeight: 1.25, maxWidth: 600 }}>The change-impact graph for your company</div>
        </div>
      </div>
    ),
    size,
  );
}
