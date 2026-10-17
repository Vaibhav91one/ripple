import { Ellipsis } from "lucide-react";
import { card, hatch } from "../margin/hatch";

export type SteppedBarsProps = {
  title: string;
  figure: string;
  chip: string;
  text: string;
  kv: { label: string; value: string }[];
  /** One column per date, oldest first. The last column is solid. */
  columns: { date: string; value: number; label: string }[];
  min: number;
  max: number;
  tooltip: { at: number; text: [string, string] };
  menuLabel?: string;
};

const H = 190;

export function SteppedBars({ title, figure, chip, text, kv, columns, min, max, tooltip, menuLabel = "More" }: SteppedBarsProps) {
  const bar = (v: number) => Math.max(((v - min) / (max - min)) * H, 2);
  const lastIdx = columns.length - 1;
  return (
    <section className={`${card} overflow-hidden`}>
      <div className="flex items-start justify-between p-5 pb-3">
        <h4 className="text-md font-medium leading-5 text-strong">{title}</h4>
        <button type="button" aria-label={menuLabel} className="grid size-8 place-items-center rounded-full border border-hairline text-body focus-visible:outline-2 focus-visible:outline-ripple">
          <Ellipsis size={14} />
        </button>
      </div>
      <div className="flex gap-5 pl-5">
        <div className="w-[190px] shrink-0 pb-5">
          <p className="text-4xl font-normal leading-none tracking-[-0.04em] text-strong">{figure}</p>
          <p className="mt-3">
            <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface px-2 py-[3px] text-xs font-medium text-strong shadow-[0_1px_2px_var(--hairline)]">
              <span className="text-3xs text-covered">▲</span>
              {chip}
            </span>
          </p>
          <p className="mt-3 text-xs leading-[18px] text-body">{text}</p>
          <dl className="mt-5 space-y-2 text-2xs">
            {kv.map((r) => (
              <div key={r.label} className="flex gap-4">
                <dt className="w-[64px] shrink-0 text-faint">{r.label}</dt>
                <dd className="font-medium text-strong">{r.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="relative flex min-w-0 flex-1" style={{ height: H + 56 }}>
          {columns.map((c, i) => {
            const last = i === lastIdx;
            const h = bar(c.value);
            return (
              <div key={c.date} className="relative flex flex-1 flex-col border-l border-hairline pl-1.5">
                <p className="pt-1 text-2xs text-faint">{c.date}</p>
                <p className={`text-md leading-6 ${last ? "text-strong" : "text-faint"}`}>{c.label}</p>
                <div className="absolute inset-x-0 bottom-0" style={{ height: h }}>
                  <span aria-hidden className="absolute -top-2 left-1/2 h-[3px] w-3.5 -translate-x-1/2 rounded-full bg-[var(--chart-2)]" />
                  <div className="size-full rounded-t-chip" style={last ? { background: "var(--chart)" } : hatch("var(--chart)")} />
                </div>
                {i === tooltip.at && (
                  <p className="absolute right-0 z-10 whitespace-nowrap rounded-control border border-hairline bg-surface px-2 py-1 text-2xs text-strong shadow-[0_2px_8px_var(--hairline)]" style={{ bottom: h + 18 }}>
                    {tooltip.text[0]} <span className="mx-1 text-faint">|</span> {tooltip.text[1]}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
