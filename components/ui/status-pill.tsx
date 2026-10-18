export type StatusTone = "conflict" | "gap" | "covered" | "ripple" | "neutral";
const DOT: Record<StatusTone, string> = { conflict: "bg-conflict", gap: "bg-gap", covered: "bg-covered", ripple: "bg-ripple", neutral: "bg-faint" };

/** White pill, one coloured dot, dark text (margin's "Critical" / "At risk"). Colour keeps its one meaning. */
export function StatusPill({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full border border-hairline bg-surface px-2.5 text-xs font-medium text-strong">
      <span aria-hidden className={`size-1.5 rounded-full ${DOT[tone]}`} />
      {children}
    </span>
  );
}
