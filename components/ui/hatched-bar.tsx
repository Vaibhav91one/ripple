import { hatch } from "./hatch";
import { type BarTone, clamp, toneVar } from "./target-bar";

/** Plan vs actual on one track: hatched = plan (not real yet), solid = actual, a hatched red tail = the overrun past plan. */
export function HatchedBar({ plan, actual, max, tone = "ink", label }: { plan: number; actual: number; max: number; tone?: BarTone; label: string }) {
  const p = clamp(plan, 0, max);
  const a = clamp(actual, 0, max);
  return (
    <div role="img" aria-label={label} className="relative h-2.5 w-full">
      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${p}%`, ...hatch("var(--faint)") }} />
      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(a, p)}%`, background: toneVar[tone] }} />
      {a > p && <div className="absolute inset-y-0 rounded-r-full" style={{ left: `${p}%`, width: `${a - p}%`, ...hatch("var(--conflict)") }} />}
    </div>
  );
}

/** The legend that goes with HatchedBar. */
export function PlanLegend({ plan = "Plan", actual = "Actual", over = "Over plan" }: { plan?: string; actual?: string; over?: string }) {
  const sw = "inline-block h-2.5 w-4 rounded-[3px]";
  return (
    <div className="flex flex-wrap gap-4 text-xs text-faint">
      <span className="flex items-center gap-1.5"><span className={sw} style={hatch("var(--faint)")} />{plan}</span>
      <span className="flex items-center gap-1.5"><span className={`${sw} bg-strong`} />{actual}</span>
      <span className="flex items-center gap-1.5"><span className={sw} style={hatch("var(--conflict)")} />{over}</span>
    </div>
  );
}
