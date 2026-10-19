import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardHeader, Takeaway } from "./card";
import { hatch } from "./hatch";

export type WaterfallProps = {
  title: string;
  subtitle: string;
  link?: string;
  /** Where the header link goes (margin's "Leakage >"); the link is hidden without it. */
  href?: string;
  /** Value-to-percent mapping of the bar area, and the tick labels under it. */
  axis: { min: number; max: number; ticks: { value: number; label: string }[] };
  target: { label: string; text: string; value: number };
  steps: { label: string; text: string; delta: number }[];
  actual: { label: string; text: string; value: number };
  note: { lead: string; sub: string };
  /** Hatch colour of the loss steps: var(--gap) for "not told", var(--conflict) for conflicts (default var(--hatch)). */
  stepColor?: string;
};

/** Axis labels: the ends align inward so they never stick out of the card. */
export const edge = (i: number, n: number) => (i === 0 ? "" : i === n - 1 ? "-translate-x-full" : "-translate-x-1/2");

const ROW = 63; // row pitch
const BAR_TOP = 24;
const BAR_H = 18;

export function Waterfall({ title, subtitle, link, href, stepColor = "var(--hatch)", axis, target, steps, actual, note }: WaterfallProps) {
  // clamped: a step past either end of the axis stops at the card edge instead of bleeding out
  const pct = (v: number) => Math.min(100, Math.max(0, ((v - axis.min) / (axis.max - axis.min)) * 100));
  const bars = steps.map((s, i) => {
    const right = target.value - steps.slice(0, i).reduce((a, x) => a + x.delta, 0);
    const left = right - s.delta;
    return { ...s, left: pct(left), width: pct(right) - pct(left) };
  });
  const label = "flex h-4 items-center justify-between gap-3 text-sm";
  const name = "min-w-0 truncate font-medium text-strong";
  const value = "shrink-0 whitespace-nowrap";
  // text on white needs the ink shade of the hatch colour (4.5:1)
  const ink = /^var\(--(gap|conflict|covered|ripple)\)$/.test(stepColor) ? stepColor.replace(")", "-ink)") : stepColor;
  return (
    <Card>
      <CardHeader
        title={title}
        sub={subtitle}
        action={href && link ? <Link href={href} className="flex shrink-0 items-center gap-0.5 text-sm font-medium text-strong hover:text-body">{link}<ChevronRight size={15} aria-hidden /></Link> : undefined}
      />
      <div className="mt-10">
        <div className="relative" style={{ height: ROW }}>
          <p className={label}><span className={name} title={target.label}>{target.label}</span><span className={`${value} text-faint`}>{target.text}</span></p>
          <div className="absolute rounded-chip" style={{ ...hatch("var(--faint)"), top: BAR_TOP, height: BAR_H, left: 0, width: `${pct(target.value)}%` }} />
        </div>
        {bars.map((b) => (
          <div key={b.label} className="relative" style={{ height: ROW }}>
            <p className={label}><span className={name} title={b.label}>{b.label}</span><span className={`${value} font-medium`} style={{ color: ink }}>{b.text}</span></p>
            <div className="absolute rounded-chip" style={{ ...hatch(stepColor), top: BAR_TOP, height: BAR_H, left: `${b.left}%`, width: `${b.width}%` }} />
            <span aria-hidden className="absolute border-l border-dashed border-faint" style={{ left: `${b.left}%`, top: BAR_TOP + BAR_H, height: ROW - BAR_H }} />
          </div>
        ))}
        <div className="relative" style={{ height: 48 }}>
          <p className={label}><span className={name} title={actual.label}>{actual.label}</span><span className={`${value} text-faint`}>{actual.text}</span></p>
          <div className="absolute min-w-1 rounded-chip bg-[var(--chart)] shadow-hairline" style={{ top: BAR_TOP, height: BAR_H, left: 0, width: `${pct(actual.value)}%` }} />
        </div>
      </div>
      <div className="relative mt-2 h-4 text-xs text-faint" aria-hidden>
        {axis.ticks.map((t, i) => (
          <span key={t.label} className={`absolute ${edge(i, axis.ticks.length)}`} style={{ left: `${pct(t.value)}%` }}>{t.label}</span>
        ))}
      </div>
      <div className="mt-6"><Takeaway lead={note.lead} sub={note.sub} /></div>
    </Card>
  );
}
