import { ChevronRight, Mail, type LucideIcon } from "lucide-react";
import { Pill, type Tone } from "./tone";

export type SeverityRow = { icon: LucideIcon; label: string; value: string };
export type SupplierRow = { label: string; value: string; pill?: Tone };

function SignalBars() {
  return (
    <svg aria-hidden viewBox="0 0 14 12" className="size-3.5 text-conflict">
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={i * 3.6} y={9 - i * 3} width="2.4" height={3 + i * 3} rx="0.6" fill="currentColor" opacity={i < 3 ? 1 : 0.35} />
      ))}
    </svg>
  );
}

export function SeverityPanel({ heading, level, rows, supplier, note }: {
  heading: string; level: string; rows: SeverityRow[];
  supplier: { name: string; sub: string; logo: LucideIcon; rows: SupplierRow[]; link: string };
  note: { title: string; body: string };
}) {
  const Logo = supplier.logo;
  return (
    <div className="w-[264px] space-y-3">
      <section className="rounded-[var(--ref-radius)] border border-hairline bg-surface p-4">
        <header className="flex items-center justify-between">
          <h3 className="text-[13px] font-medium text-strong">{heading}</h3>
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-conflict"><SignalBars />{level}</span>
        </header>
        <ul className="mt-4 space-y-3.5">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-2.5 text-[12px]">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-raised text-body"><r.icon aria-hidden className="size-3" /></span>
              <span className="flex-1 text-body">{r.label}</span>
              <span className="font-medium text-strong">{r.value}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-[var(--ref-radius)] border border-hairline bg-surface p-4">
        <header className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-full border border-hairline bg-raised text-body"><Logo aria-hidden className="size-4" /></span>
          <div>
            <h3 className="text-[12px] font-medium text-strong">{supplier.name}</h3>
            <p className="text-[10px] text-faint">{supplier.sub}</p>
          </div>
        </header>
        <dl className="mt-3 divide-y divide-hairline">
          {supplier.rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between py-[9px] text-[11px]">
              <dt className="text-faint">{r.label}</dt>
              <dd className="font-medium text-strong">{r.pill ? <Pill tone={r.pill} dot>{r.value}</Pill> : r.value}</dd>
            </div>
          ))}
        </dl>
        <button type="button" className="mt-1 inline-flex items-center gap-1 rounded pt-2 text-[12px] font-medium text-strong focus-visible:outline-2 focus-visible:outline-ripple">
          {supplier.link}<ChevronRight aria-hidden className="size-3.5" />
        </button>
      </section>
      <aside className="flex gap-2 rounded-[10px] border border-ripple/20 bg-ripple-soft px-3 py-2.5">
        <Mail aria-hidden className="mt-0.5 size-3.5 shrink-0 text-ripple" />
        <div className="space-y-1">
          <h3 className="text-[11px] font-medium text-ripple">{note.title}</h3>
          <p className="text-[11px] leading-4 text-strong">{note.body}</p>
        </div>
      </aside>
    </div>
  );
}
