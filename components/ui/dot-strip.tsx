import { clamp } from "./target-bar";
import { edge } from "./waterfall";

export type Dot = { id: string; value: number; tone?: "conflict" | "gap" | "ripple" | "covered" | "neutral"; label?: string };
const FILL = { conflict: "bg-conflict", gap: "bg-gap", ripple: "bg-ripple", covered: "bg-covered", neutral: "bg-faint/50" } as const;

/** Stack dots that land in the same column (a simple beeswarm). Returns [x%, row] per dot, in input order. */
export function layoutDots(values: number[], min: number, max: number, cols: number): [number, number][] {
  const used = new Map<number, number>();
  return values.map((v) => {
    const col = Math.round((clamp(v, min, max) / 100) * (cols - 1));
    const row = used.get(col) ?? 0;
    used.set(col, row + 1);
    return [(col / (cols - 1)) * 100, row];
  });
}

/** One dot per record along an axis, stacked where they collide; an optional dashed marker (target or median). */
export function DotStrip({ dots, min, max, cols = 48, marker, ticks, selected, label }: { dots: Dot[]; min: number; max: number; cols?: number; marker?: { value: number; label: string }; ticks?: { value: number; label: string }[]; selected?: string; label: string }) {
  const pos = layoutDots(dots.map((d) => d.value), min, max, cols);
  const rows = Math.max(1, ...pos.map(([, r]) => r + 1));
  const pitch = 13;
  return (
    <figure aria-label={label} className="w-full">
      <div className="relative mx-1.5" style={{ height: rows * pitch + 22 }}>
        {marker && (
          <div className="absolute inset-y-0 border-l border-dashed border-strong/60" style={{ left: `${clamp(marker.value, min, max)}%` }}>
            <span className="absolute -top-0.5 left-1.5 whitespace-nowrap text-xs font-medium text-strong">{marker.label}</span>
          </div>
        )}
        {dots.map((d, i) => (
          <span
            key={d.id}
            title={d.label}
            className={`absolute size-[9px] -translate-x-1/2 rounded-full ${FILL[d.tone ?? "neutral"]} ${selected === d.id ? "ring-2 ring-strong ring-offset-2 ring-offset-surface" : ""}`}
            style={{ left: `${pos[i][0]}%`, bottom: pos[i][1] * pitch }}
          />
        ))}
      </div>
      {ticks && (
        <div className="relative mx-1.5 mt-3 h-4 text-xs text-faint">
          {ticks.map((t, i) => <span key={t.label} className={`absolute whitespace-nowrap ${edge(i, ticks.length)}`} style={{ left: `${clamp(t.value, min, max)}%` }}>{t.label}</span>)}
        </div>
      )}
    </figure>
  );
}
