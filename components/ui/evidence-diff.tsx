import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export type Chip = { text: string; tone?: "conflict" | "covered" };
export type ChipGroup = { label: string; chips: Chip[]; caption: string };

const CHIP = {
  none: "border-hairline bg-raised text-strong",
  conflict: "border-conflict/30 bg-conflict-soft text-conflict-ink",
  covered: "border-covered/30 bg-covered-soft text-covered-ink",
} as const;

export function EvidenceDiff({ title, found, action, onAction, actionNode, docLine, groups }: {
  title: string; found: string; action: string;
  /** Called by the header action button. */
  onAction?: () => void;
  /** Replaces the header action button (a gated button in the read-only demo). */
  actionNode?: ReactNode;
  /** The highlighted line inside the document thumbnail. */
  docLine: string;
  groups: ChipGroup[];
}) {
  const bar = "h-[3px] rounded-full bg-hairline";
  return (
    <section className="min-w-0 sm:min-w-[520px] max-w-[620px] rounded-[var(--ref-radius)] border border-hairline bg-surface p-[3px] shadow-[0_0_0_3px_var(--raised)]">
      <div className="rounded-[calc(var(--ref-radius)-3px)] border border-hairline px-5 pb-5 pt-4">
        <header className="flex items-baseline justify-between border-b border-dotted border-hairline pb-4">
          <h3 className="text-md font-medium text-strong">{title}</h3>
          <p className="flex items-center gap-3 text-2xs text-faint">
            {found}
            {actionNode ?? (
              <button type="button" onClick={onAction} className="inline-flex items-center gap-0.5 rounded-control text-xs font-medium text-strong focus-visible:outline-2 focus-visible:outline-ripple">
                {action}<ChevronRight aria-hidden className="size-3.5" />
              </button>
            )}
          </p>
        </header>
        <div className="mt-5 flex gap-5">
          <div aria-hidden className="hidden h-[138px] w-[180px] shrink-0 sm:block rounded-control border border-hairline bg-raised px-3 pt-3">
            <div className="h-full space-y-2.5 rounded-t-control border border-b-0 border-hairline bg-surface px-3 pt-3 shadow-card">
              <div className="space-y-1.5">
                <div className={`${bar} w-1/2 bg-faint/40`} />
                <div className={`${bar} ml-auto w-1/4`} />
                <div className={`${bar} ml-auto w-1/4`} />
              </div>
              <div className="rounded-control border border-conflict/30 bg-conflict-soft whitespace-nowrap px-1.5 py-1 font-mono text-3xs text-conflict-ink">{docLine}</div>
              <div className="space-y-2 pt-1">
                <div className={bar} /><div className={`${bar} w-5/6`} /><div className={bar} />
              </div>
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-4">
            {groups.map((g) => (
              <div key={g.label} className="space-y-1.5">
                <p className="text-3xs font-medium uppercase tracking-[0.06em] text-faint">{g.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {g.chips.map((c) => (
                    <span key={c.text} className={`rounded-control border px-2 py-[3px] font-mono text-sm ${CHIP[c.tone ?? "none"]}`}>{c.text}</span>
                  ))}
                </div>
                <p className="text-2xs text-faint">{g.caption}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
