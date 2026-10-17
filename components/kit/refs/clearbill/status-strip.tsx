import { TriangleAlert } from "lucide-react";
import { Pill, type Tone } from "./tone";

export type StatusCell = { label: string; value: string; pill?: Tone };

export function StatusStrip({ crumb, title, status, meta, cells }: {
  crumb: [string, string];
  title: string;
  status: { label: string; tone: Tone };
  meta: string;
  cells: StatusCell[];
}) {
  return (
    <section className="min-w-[520px] max-w-[620px] space-y-3">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-faint">
        <TriangleAlert aria-hidden className="size-3.5" />
        <span>{crumb[0]}</span>
        <span aria-hidden>/</span>
        <span className="font-medium text-strong">{crumb[1]}</span>
      </nav>
      <div>
        <h2 className="flex items-center gap-2.5 text-xl font-medium leading-9 tracking-[-0.01em] text-strong">
          {title}
          <Pill tone={status.tone}>{status.label}</Pill>
        </h2>
        <p className="mt-1 text-sm text-body">{meta}</p>
      </div>
      <dl className="grid divide-x divide-hairline rounded-[var(--ref-radius)] border border-hairline bg-surface py-4" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>
        {cells.map((c, i) => (
          <div key={c.label} className={`space-y-1.5 ${i === 0 ? "px-4" : "px-5"}`}>
            <dt className="text-3xs font-medium uppercase tracking-[0.06em] text-faint">{c.label}</dt>
            <dd className="text-sm text-strong">{c.pill ? <Pill tone={c.pill} dot>{c.value}</Pill> : c.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
