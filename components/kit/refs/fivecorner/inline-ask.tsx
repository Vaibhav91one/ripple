import { ChevronUp, Sparkles } from "lucide-react";

export type InlineAskProps = {
  heading: string;
  before: string;
  /** Slash command chip, e.g. "/buyer tax ID". */
  chip: string;
};

export function InlineAsk({ heading, before, chip }: InlineAskProps) {
  return (
    <section className="rounded-[var(--ref-radius)] border border-hairline bg-ripple-soft p-1.5 shadow-[0_6px_20px_color-mix(in_srgb,var(--chart)_14%,transparent)]">
      <button type="button" aria-expanded="true" className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-2xs text-body focus-visible:outline-2 focus-visible:outline-ripple">
        <Sparkles size={12} className="text-ripple" aria-hidden />
        <span className="flex-1">{heading}</span>
        <ChevronUp size={14} className="text-faint" aria-hidden />
      </button>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-control border border-hairline bg-surface px-3 py-2.5 text-xs text-strong">
        <span>{before}</span>
        <span className="rounded-control border border-gap bg-gap-soft px-2 py-0.5 text-2xs font-medium">{chip}</span>
      </div>
    </section>
  );
}
