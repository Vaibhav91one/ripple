// Blast Radius mark: a dot with three quarter-arcs radiating from it. The outer arc is broken and amber (the team that wasn't told).
// Geometry is shared with the landing illustration (RippleHero) and mirrored in app/icon.svg. Colours come from tokens.
export const MARK = {
  dot: { x: 6, y: 26, r: 3 },
  arcs: [
    ["M13 26 A7 7 0 0 0 6 19"],
    ["M19 26 A13 13 0 0 0 6 13"],
    ["M25 26 A19 19 0 0 0 21.56 15.1", "M16.9 10.44 A19 19 0 0 0 6 7"],
  ],
} as const;

export function Mark({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" strokeWidth="2.6" strokeLinecap="round" className={className} aria-hidden>
      <g className="text-ripple" stroke="currentColor">
        <circle cx={MARK.dot.x} cy={MARK.dot.y} r={MARK.dot.r} fill="currentColor" stroke="none" />
        <path d={MARK.arcs[0][0]} opacity=".9" />
        <path d={MARK.arcs[1][0]} opacity=".65" />
      </g>
      <g stroke="var(--gap)">
        {MARK.arcs[2].map((d) => <path key={d} d={d} />)}
      </g>
    </svg>
  );
}
