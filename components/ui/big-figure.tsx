import { Ellipsis } from "lucide-react";
import { card, hatch } from "./hatch";

export type BigFigureProps = {
  title: string;
  period: string;
  figure: string;
  delta: { value: string; dir: "up" | "down"; tone: "good" | "bad"; vs: string };
  text: string;
  /** Percent of the bar (0..100) that is filled and where the target marker sits. */
  bar: { fill: number; marker: number; from: string; markerLabel: string };
  rows: { label: string; value: string; chip?: { text: string; dir: "up" | "down" } }[];
  menuLabel?: string;
};

const arrow = (dir: "up" | "down") => (dir === "up" ? "▲" : "▼");

export function BigFigure({ title, period, figure, delta, text, bar, rows, menuLabel = "More" }: BigFigureProps) {
  return (
    <section className={`${card} p-5`}>
      <header className="flex items-start justify-between">
        <div>
          <h4 className="text-md font-medium leading-5 text-strong">{title}</h4>
          <p className="mt-0.5 text-2xs text-faint">{period}</p>
        </div>
        <button type="button" aria-label={menuLabel} className="grid size-8 place-items-center rounded-full border border-hairline text-body focus-visible:outline-2 focus-visible:outline-ripple">
          <Ellipsis size={14} />
        </button>
      </header>
      <p className="mt-3 text-4xl font-normal leading-none tracking-[-0.04em] text-strong">{figure}</p>
      <p className="mt-3 flex items-center gap-2 text-2xs text-faint">
        <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface px-2 py-[3px] text-xs font-medium text-strong shadow-card">
          <span className={`text-3xs ${delta.tone === "bad" ? "text-conflict-ink" : "text-covered-ink"}`}>{arrow(delta.dir)}</span>
          {delta.value}
        </span>
        {delta.vs}
      </p>
      <p className="mt-3 text-xs leading-[18px] text-body">{text}</p>
      <div className="mt-4">
        <div className="relative h-[14px] overflow-hidden rounded-chip bg-raised shadow-[inset_0_0_0_1px_var(--hairline)]">
          <div className="h-full rounded-chip" style={{ ...hatch("var(--chart)"), width: `${bar.fill}%` }} />
          <span className="absolute inset-y-0 w-px bg-strong" style={{ left: `${bar.marker}%` }} />
        </div>
        <div className="relative mt-1.5 h-4 text-2xs text-faint">
          <span className="absolute left-0">{bar.from}</span>
          <span className="absolute whitespace-nowrap" style={{ left: `${bar.marker}%`, transform: `translateX(-${bar.marker}%)` }}>{bar.markerLabel}</span>
        </div>
      </div>
      <dl className="mt-3 border-t border-hairline">
        {rows.map((r) => (
          <div key={r.label} className="flex h-[38px] items-center justify-between border-b border-hairline text-xs last:border-b-0">
            <dt className="text-faint">{r.label}</dt>
            <dd className="flex items-center gap-2 text-sm font-medium text-strong">
              {r.value}
              {r.chip && (
                <span className="inline-flex items-center gap-1 rounded-full border border-hairline px-2 py-[3px] text-xs shadow-card">
                  <span className={`text-3xs ${r.chip.dir === "up" ? "text-covered-ink" : "text-conflict-ink"}`}>{arrow(r.chip.dir)}</span>
                  {r.chip.text}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
