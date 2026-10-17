import { ChevronRight, FileText, RefreshCw, ScrollText, X } from "lucide-react";
import { hatch } from "../margin/hatch";
import { TrustChecklist, type TrustChecklistProps } from "./trust-checklist";

export type ChangeDrawerProps = {
  title: string;
  subtitle: string;
  versionsHeading: string;
  versions: { icon: "guide" | "doc"; name: string; sub: string; badge: string }[];
  changedHeading: string;
  affected: string;
  changes: { title: string; sub: string; count: number; unit: string; pct: number }[];
  rescored: { title: string; sub: string };
  trust: TrustChecklistProps;
  closeLabel: string;
  primaryLabel: string;
};

const tile = { guide: ScrollText, doc: FileText } as const;
const box = "rounded-xl border border-hairline bg-surface";

export function ChangeDrawer({ title, subtitle, versionsHeading, versions, changedHeading, affected, changes, rescored, trust, closeLabel, primaryLabel }: ChangeDrawerProps) {
  return (
    <aside aria-label={title} className="w-full max-w-[390px] rounded-[24px] border border-hairline bg-raised p-5 shadow-[0_8px_30px_var(--hairline)]">
      <header className="flex items-start justify-between gap-3">
        <h4 className="text-[18px] font-medium leading-7 text-strong">{title}</h4>
        <button type="button" aria-label={closeLabel} className="grid size-8 place-items-center rounded-full border border-hairline bg-surface text-strong focus-visible:outline-2 focus-visible:outline-ripple">
          <X size={14} />
        </button>
      </header>
      <p className="mt-1 text-[11px] leading-4 text-faint">{subtitle}</p>

      <h5 className="mt-6 text-[11px] font-medium text-strong">{versionsHeading}</h5>
      <ul className={`${box} mt-2 divide-y divide-transparent p-2`}>
        {versions.map((v) => {
          const Icon = tile[v.icon];
          return (
            <li key={v.name} className="flex items-center gap-2.5 p-1.5">
              <span className="grid size-[30px] shrink-0 place-items-center rounded-lg bg-raised text-body"><Icon size={15} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-medium leading-4 text-strong">{v.name}</span>
                <span className="block text-[10px] text-faint">{v.sub}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-2 py-0.5 text-[10px] font-medium text-strong">
                <span className="size-1.5 rounded-full bg-covered" />
                {v.badge}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex items-baseline justify-between">
        <h5 className="text-[11px] font-medium text-strong">{changedHeading}</h5>
        <span className="text-[10px] text-faint">{affected}</span>
      </div>
      <ul className="mt-2 space-y-2">
        {changes.map((c) => (
          <li key={c.title} className={`${box} p-3`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium leading-4 text-strong">{c.title}</p>
                <p className="mt-0.5 text-[10px] text-faint">{c.sub}</p>
              </div>
              <div className="text-right">
                <p className="text-[15px] font-medium leading-4 text-strong">{c.count}</p>
                <p className="mt-0.5 text-[9px] text-faint">{c.unit}</p>
              </div>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-raised">
              <div className="h-full rounded-full" style={{ ...hatch("var(--chart)"), width: `${c.pct}%` }} />
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex items-center gap-3 rounded-xl bg-[color-mix(in_srgb,var(--hairline)_55%,transparent)] p-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full border border-hairline bg-surface text-strong"><RefreshCw size={14} /></span>
        <div>
          <p className="text-[11px] font-medium text-strong">{rescored.title}</p>
          <p className="text-[10px] text-faint">{rescored.sub}</p>
        </div>
      </div>

      <div className="mt-6"><TrustChecklist {...trust} /></div>

      <footer className="mt-6 flex items-center justify-end gap-2">
        <button type="button" className="rounded-lg border border-hairline bg-surface px-3.5 py-2 text-[12px] font-medium text-strong focus-visible:outline-2 focus-visible:outline-ripple">{closeLabel}</button>
        <button type="button" className="flex items-center gap-1.5 rounded-lg bg-strong px-3.5 py-2 text-[12px] font-medium text-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ripple">
          <ChevronRight size={13} />
          {primaryLabel}
        </button>
      </footer>
    </aside>
  );
}
