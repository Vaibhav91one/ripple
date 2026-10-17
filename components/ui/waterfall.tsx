import { ChevronRight } from "lucide-react";
import { card, hatch } from "./hatch";

export type WaterfallProps = {
  title: string;
  subtitle: string;
  link: string;
  /** Value-to-percent mapping of the bar area, and the tick labels under it. */
  axis: { min: number; max: number; ticks: { value: number; label: string }[] };
  target: { label: string; text: string; value: number };
  steps: { label: string; text: string; delta: number }[];
  actual: { label: string; text: string; value: number };
  note: { lead: string; sub: string };
};

const ROW = 63; // row pitch
const BAR_TOP = 24;
const BAR_H = 18;

export function Waterfall({ title, subtitle, link, axis, target, steps, actual, note }: WaterfallProps) {
  const pct = (v: number) => ((v - axis.min) / (axis.max - axis.min)) * 100;
  const bars = steps.map((s, i) => {
    const right = target.value - steps.slice(0, i).reduce((a, x) => a + x.delta, 0);
    const left = right - s.delta;
    return { ...s, left: pct(left), width: pct(right) - pct(left) };
  });
  const label = "flex h-4 items-center justify-between text-xs";
  return (
    <section className={`${card} p-5`}>
      <header className="flex items-start justify-between">
        <div>
          <h4 className="text-md font-medium leading-5 text-strong">{title}</h4>
          <p className="mt-0.5 text-2xs text-faint">{subtitle}</p>
        </div>
        <button type="button" className="flex items-center gap-0.5 text-xs font-medium text-strong focus-visible:outline-2 focus-visible:outline-ripple">
          {link}
          <ChevronRight size={14} />
        </button>
      </header>
      <div className="mt-10">
        <div className="relative" style={{ height: ROW }}>
          <p className={label}><span className="font-medium text-strong">{target.label}</span><span className="text-faint">{target.text}</span></p>
          <div className="absolute rounded-chip" style={{ ...hatch("var(--faint)"), top: BAR_TOP, height: BAR_H, left: 0, width: `${pct(target.value)}%` }} />
        </div>
        {bars.map((b) => (
          <div key={b.label} className="relative" style={{ height: ROW }}>
            <p className={label}><span className="font-medium text-strong">{b.label}</span><span className="font-medium text-[var(--hatch)]">{b.text}</span></p>
            <div className="absolute rounded-chip" style={{ ...hatch("var(--hatch)"), top: BAR_TOP, height: BAR_H, left: `${b.left}%`, width: `${b.width}%` }} />
            <span aria-hidden className="absolute border-l border-dashed border-faint" style={{ left: `${b.left}%`, top: BAR_TOP + BAR_H, height: ROW - BAR_H }} />
          </div>
        ))}
        <div className="relative" style={{ height: 48 }}>
          <p className={label}><span className="font-medium text-strong">{actual.label}</span><span className="text-faint">{actual.text}</span></p>
          <div className="absolute min-w-1 rounded-chip bg-[var(--chart)] shadow-[0_2px_6px_color-mix(in_srgb,var(--chart)_45%,transparent)]" style={{ top: BAR_TOP, height: BAR_H, left: 0, width: `${pct(actual.value)}%` }} />
        </div>
      </div>
      <div className="relative mt-2 h-4 text-2xs text-faint" aria-hidden>
        {axis.ticks.map((t) => (
          <span key={t.label} className="absolute -translate-x-1/2" style={{ left: `${pct(t.value)}%` }}>{t.label}</span>
        ))}
      </div>
      <div className="mt-6 rounded-card border border-hairline bg-surface p-3 shadow-[0_1px_2px_var(--hairline)]">
        <p className="text-xs font-medium leading-[17px] text-strong">{note.lead}</p>
        <p className="mt-0.5 text-2xs text-faint">{note.sub}</p>
      </div>
    </section>
  );
}
