export type StatusTone = "conflict" | "gap" | "covered" | "ripple" | "neutral";
const DOT: Record<StatusTone, string> = { conflict: "bg-conflict", gap: "bg-gap", covered: "bg-covered", ripple: "bg-ripple", neutral: "bg-faint" };

/** White pill, one coloured dot, dark text (margin's "Critical" / "At risk"). Covered is the one filled pill (green, readable ink): "this is done". */
export function StatusPill({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  const skin = tone === "covered" ? "border-covered-soft bg-covered-soft text-covered-ink" : "border-hairline bg-surface text-strong";
  return (
    <span className={`inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-medium ${skin}`}>
      <span aria-hidden className={`size-1.5 rounded-full ${DOT[tone]}`} />
      {children}
    </span>
  );
}
