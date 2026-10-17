import { card, hatch } from "./hatch";

export type WeeklyBarsProps = {
  title: string;
  caption: string;
  /** One value per week, oldest first. The last bar is solid and labelled. */
  values: number[];
  min: number;
  max: number;
  target: { value: number; label: string };
  lastLabel: string;
  xLabels: [string, string];
};

const H = 230;

export function WeeklyBars({ title, caption, values, min, max, target, lastLabel, xLabels }: WeeklyBarsProps) {
  const y = (v: number) => Math.max(((v - min) / (max - min)) * H, 2);
  return (
    <section className={`${card} p-5`}>
      <header className="flex items-baseline justify-between">
        <h4 className="text-[16px] font-medium leading-5 text-strong">{title}</h4>
        <p className="text-[11px] text-faint">{caption}</p>
      </header>
      <div className="relative mt-6" style={{ height: H + 24 }}>
        <div className="absolute inset-x-0 border-t border-dashed border-strong" style={{ bottom: y(target.value) }}>
          <span className="absolute -top-5 right-0 text-[11px] text-faint">{target.label}</span>
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-[6px]" style={{ height: H }}>
          {values.map((v, i) => {
            const last = i === values.length - 1;
            return (
              <div key={i} className="relative flex-1 rounded-t-[3px]" style={last ? { height: y(v), background: "var(--chart)", boxShadow: "0 2px 6px color-mix(in srgb, var(--chart) 45%, transparent)" } : { height: y(v), ...hatch("var(--chart)") }}>
                {last && <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-medium text-strong">{lastLabel}</span>}
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-2 flex justify-between text-[11px] text-faint"><span>{xLabels[0]}</span><span>{xLabels[1]}</span></p>
    </section>
  );
}
