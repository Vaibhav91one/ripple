import { hatch } from "./hatch";

export type BarTone = "ink" | "ripple" | "gap" | "conflict" | "neutral" | "covered";
export const toneVar: Record<BarTone, string> = { covered: "var(--covered)", ink: "var(--strong)", ripple: "var(--ripple)", gap: "var(--gap)", conflict: "var(--conflict)", neutral: "var(--faint)" };
/** Position of v on [min, max] as a percent, clamped to 0..100. */
export const pct = (v: number, min: number, max: number) => Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));

/** Progress to target: a hatched fill up to the value and a black tick at the target, labels under both ends. */
export function TargetBar({ value, target, min = 0, max = 100, from, targetLabel, tone = "ripple", label }: { value: number; target: number; min?: number; max?: number; from: string; targetLabel: string; tone?: BarTone; label: string }) {
  const t = pct(target, min, max);
  return (
    <div role="meter" aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}>
      <div className="relative h-3 rounded-full bg-raised">
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct(value, min, max)}%`, ...hatch(toneVar[tone]) }} />
        <span aria-hidden className="absolute -top-1.5 h-6 w-[2px] -translate-x-1/2 rounded-full bg-strong" style={{ left: `${t}%` }} />
      </div>
      <div className="relative mt-2 h-4 text-xs text-faint">
        <span className="absolute left-0">{from}</span>
        <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${Math.min(t, 88)}%` }}>{targetLabel}</span>
      </div>
    </div>
  );
}
