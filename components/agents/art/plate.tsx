// Shared grammar for the agent illustrations: 160x120, a soft rounded plate with a hairline, one 8% shadow, token colours only.
// Each art file draws its object inside <Plate>; `A` / `AS` are the agent's accent and its -soft variant.
export type Accent = "ripple" | "covered" | "gap" | "conflict";
export const A = "var(--art-a)";
export const AS = "var(--art-as)";
/** 2px round-cap detail stroke. */
export const line = (stroke = "var(--faint)") => ({ stroke, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" }) as const;

export function Plate({ accent, shadow = { cx: 80, cy: 96, rx: 36 }, className, children }: { accent: Accent; shadow?: { cx: number; cy: number; rx: number }; className?: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 160 120" aria-hidden="true" focusable="false" className={className}
      style={{ "--art-a": `var(--${accent})`, "--art-as": `var(--${accent}-soft)` } as React.CSSProperties}>
      <rect x="0.5" y="0.5" width="159" height="119" rx="16" fill="var(--raised)" />
      <rect x="0.5" y="0.5" width="159" height="119" rx="16" fill={AS} stroke="var(--hairline)" />
      <ellipse cx={shadow.cx} cy={shadow.cy} rx={shadow.rx} ry="5" fill="var(--strong)" opacity="0.08" />
      {children}
    </svg>
  );
}
