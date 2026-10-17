import { ChevronRight } from "lucide-react";

export type Chip = { text: string; tone?: "conflict" | "covered" };
export type ChipGroup = { label: string; chips: Chip[]; caption: string };

const CHIP = {
  none: "border-hairline bg-raised text-strong",
  conflict: "border-conflict/30 bg-conflict-soft text-conflict",
  covered: "border-covered/30 bg-covered-soft text-covered",
} as const;

export function EvidenceDiff({ title, found, action, docLine, groups }: {
  title: string; found: string; action: string;
  /** The highlighted line inside the document thumbnail. */
  docLine: string;
  groups: ChipGroup[];
}) {
  const bar = "h-[3px] rounded-full bg-hairline";
  return (
    <section className="min-w-[520px] max-w-[620px] rounded-[var(--ref-radius)] border border-hairline bg-surface p-[3px] shadow-[0_0_0_3px_var(--raised)]">
      <div className="rounded-[calc(var(--ref-radius)-3px)] border border-hairline px-5 pb-5 pt-4">
        <header className="flex items-baseline justify-between border-b border-dotted border-hairline pb-4">
          <h3 className="text-[15px] font-medium text-strong">{title}</h3>
          <p className="flex items-center gap-3 text-[11px] text-faint">
            {found}
            <button type="button" className="inline-flex items-center gap-0.5 rounded text-[12px] font-medium text-strong focus-visible:outline-2 focus-visible:outline-ripple">
              {action}<ChevronRight aria-hidden className="size-3.5" />
            </button>
          </p>
        </header>
        <div className="mt-5 flex gap-5">
          <div aria-hidden className="h-[138px] w-[180px] shrink-0 rounded-md border border-hairline bg-raised px-3 pt-3">
            <div className="h-full space-y-2.5 rounded-t border border-b-0 border-hairline bg-surface px-3 pt-3 shadow-sm">
              <div className="space-y-1.5">
                <div className={`${bar} w-1/2 bg-faint/40`} />
                <div className={`${bar} ml-auto w-1/4`} />
                <div className={`${bar} ml-auto w-1/4`} />
              </div>
              <div className="rounded border border-conflict/30 bg-conflict-soft whitespace-nowrap px-1.5 py-1 font-mono text-[8px] text-conflict">{docLine}</div>
              <div className="space-y-2 pt-1">
                <div className={bar} /><div className={`${bar} w-5/6`} /><div className={bar} />
              </div>
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-4">
            {groups.map((g) => (
              <div key={g.label} className="space-y-1.5">
                <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-faint">{g.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {g.chips.map((c) => (
                    <span key={c.text} className={`rounded-md border px-2 py-[3px] font-mono text-[13px] ${CHIP[c.tone ?? "none"]}`}>{c.text}</span>
                  ))}
                </div>
                <p className="text-[11px] text-faint">{g.caption}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
