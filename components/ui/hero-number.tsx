export type Delta = { value: string; dir: "up" | "down"; tone: "good" | "bad" | "neutral"; vs?: string };

const TONE = { good: "text-covered-ink", bad: "text-conflict-ink", neutral: "text-faint" } as const;

/** White pill with a triangle and a value, then the grey qualifier ("vs yesterday"). A bare number never ships without one. */
export function DeltaChip({ value, dir, tone, vs }: Delta) {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-hairline bg-surface px-2.5 font-medium text-strong">
        <span aria-hidden className={`text-3xs ${TONE[tone]}`}>{dir === "up" ? "▲" : "▼"}</span>
        <span className="sr-only">{dir === "up" ? "up" : "down"}</span>
        {value}
      </span>
      {vs && <span className="text-faint">{vs}</span>}
    </span>
  );
}

/** One hero number per card (light weight, tight tracking), its delta chip, then the sentence that explains it. */
export function HeroNumber({ value, unit, delta, children, size = "hero" }: { value: string; unit?: string; delta?: Delta; children?: React.ReactNode; size?: "hero" | "lg" }) {
  return (
    <div>
      <p className={`font-light leading-none tracking-[-0.045em] text-strong tabular-nums ${size === "hero" ? "text-6xl sm:text-hero" : "text-4xl"}`}>
        {value}
        {unit && <span className="ml-2 align-top text-md font-normal tracking-normal text-faint">{unit}</span>}
      </p>
      {delta && <div className="mt-4"><DeltaChip {...delta} /></div>}
      {children && <p className="mt-4 max-w-prose text-md leading-relaxed text-faint">{children}</p>}
    </div>
  );
}
