import type { ReactNode } from "react";

export type Tone = "covered" | "conflict" | "gap" | "ripple";

const TONE: Record<Tone, string> = {
  covered: "bg-covered-soft text-covered",
  conflict: "bg-conflict-soft text-conflict",
  gap: "bg-gap-soft text-gap",
  ripple: "bg-ripple-soft text-ripple",
};

/** Small tinted status pill; `dot` adds the leading status dot. */
export function Pill({ tone, dot, children }: { tone: Tone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] text-2xs font-medium leading-none ${TONE[tone]}`}>
      {dot && <span aria-hidden className="size-[5px] rounded-full bg-current" />}
      {children}
    </span>
  );
}
