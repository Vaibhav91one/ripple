// Blast Radius mark: a centre dot and two full rings. The outer ring has one short break, drawn in amber (the team that wasn't told).
// Geometry (viewBox 32) is mirrored in app/icon.svg. Colours come from tokens.
export const MARK = {
  c: 16,
  dotR: 3,
  rings: [{ r: 7, opacity: 0.75 }],
  outerR: 13,
  // Teal outer ring minus a 50 degree gap (with 5 degree margins); the amber piece fills the gap.
  outerTeal: "M19.36 3.44 A13 13 0 1 0 28.56 12.64",
  outerAmber: "M28.22 11.55 A13 13 0 0 0 20.45 3.78",
} as const;

export function Mark({ size = 18, className }: { size?: number; className?: string }) {
  const { c, dotR, rings } = MARK;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" strokeWidth="2.6" strokeLinecap="round" className={className} aria-hidden>
      <g className="text-ripple" stroke="currentColor">
        <circle cx={c} cy={c} r={dotR} fill="currentColor" stroke="none" />
        {rings.map((r) => <circle key={r.r} cx={c} cy={c} r={r.r} opacity={r.opacity} />)}
        <path d={MARK.outerTeal} opacity=".5" />
      </g>
      <path d={MARK.outerAmber} stroke="var(--gap)" />
    </svg>
  );
}
