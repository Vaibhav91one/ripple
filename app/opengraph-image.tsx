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
            <circle cx="16" cy="16" r="3" fill={TEAL} stroke="none" />
            <circle cx="16" cy="16" r="7" opacity=".75" />
            <path d="M19.36 3.44 A13 13 0 1 0 28.56 12.64" opacity=".5" />
          </g>
          <path d="M28.22 11.55 A13 13 0 0 0 20.45 3.78" stroke={AMBER} />
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
