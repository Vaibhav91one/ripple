// Beautiful UI (beautifului.dev), MIT, see ../LICENSE. Restyled to Ripple tokens.
"use client";

/* ─────────────────────────────────────────────────────────
 * SHIMMER — a light sweep travelling across a text label.
 *
 * A 200%-wide gradient is clipped to the glyphs and slid
 * from right to left, so the highlight reads as motion
 * through the word rather than a flashing opacity.
 * ───────────────────────────────────────────────────────── */

export function Shimmer({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`bg-clip-text text-transparent ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(90deg, var(--faint) 35%, var(--strong) 50%, var(--faint) 65%)",
        backgroundSize: "200% 100%",
        animation: "shimmer-text 1.4s linear infinite",
      }}
    >
      {children}
    </span>
  );
}
