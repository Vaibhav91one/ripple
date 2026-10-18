import type { ReactNode } from "react";

/** The one tone type: each status colour keeps its one meaning (covered = done, gap = not told, conflict = conflict, ripple = the traced path). */
export type Tone = "covered" | "conflict" | "gap" | "ripple" | "neutral";

/** Tinted surface + readable ink (>= 4.5:1, lib/contrast.test.ts). */
export const TINT: Record<Tone, string> = {
  covered: "bg-covered-soft text-covered-ink",
  conflict: "bg-conflict-soft text-conflict-ink",
  gap: "bg-gap-soft text-gap-ink",
  ripple: "bg-ripple-soft text-ripple-ink",
  neutral: "bg-raised text-body",
};
/** The bare colour, for dots, bars and icons on their own. */
export const DOT: Record<Tone, string> = { conflict: "bg-conflict", gap: "bg-gap", covered: "bg-covered", ripple: "bg-ripple", neutral: "bg-faint" };

/** Small tinted status pill; `dot` adds the leading status dot. */
export function Pill({ tone, dot, children }: { tone: Tone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-2xs font-medium leading-tight ${TINT[tone]}`}>
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** White pill, one coloured dot, dark text (margin's "Critical" / "At risk"). Covered is the one filled pill (green, readable ink): "this is done". */
export function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  const skin = tone === "covered" ? "border-covered-soft bg-covered-soft text-covered-ink" : "border-hairline bg-surface text-strong";
  return (
    <span className={`inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-medium ${skin}`}>
      <span aria-hidden className={`size-1.5 rounded-full ${DOT[tone]}`} />
      {children}
    </span>
  );
}
