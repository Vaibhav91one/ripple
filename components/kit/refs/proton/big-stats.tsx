// BigStats: a plain heading over large light-weight numerals with small labels, groups split by a hairline.
import type { ReactNode } from "react";

export type StatGroup = {
  heading: string;
  stats: { value: string; label: string }[];
  /** Mono numerals (the left group in the reference) vs sans. */
  mono?: boolean;
  /** Accent-coloured numerals (the green group). */
  accent?: boolean;
  /** Fixed 175px columns instead of a tight gap. */
  spread?: boolean;
  /** Anything rendered under the numbers (a card). */
  below?: ReactNode;
};

export function BigStats({ groups }: { groups: StatGroup[] }) {
  return (
    <div className="grid w-full" style={{ gridTemplateColumns: `repeat(${groups.length}, minmax(0, 1fr))` }}>
      {groups.map((g, i) => (
        <section key={g.heading} className={`min-w-0 ${i > 0 ? "border-l border-hairline pl-8" : ""} ${i < groups.length - 1 ? "pr-8" : ""}`}>
          <h4 className="text-[33px] font-medium leading-[1.15] tracking-[-0.03em] text-strong">{g.heading}</h4>
          <dl className={`mt-2 flex ${g.spread ? "" : "gap-x-10"}`}>
            {g.stats.map((s) => (
              <div key={s.label} className={g.spread ? "w-[135px]" : ""}>
                <dd className={`text-[70px] ${g.mono ? "font-mono font-normal" : "font-light"} leading-[1.05] tracking-[-0.04em] ${g.accent ? "text-ripple" : "text-strong"}`}>{s.value}</dd>
                <dt className="text-[19px] leading-6 text-faint">{s.label}</dt>
              </div>
            ))}
          </dl>
          {g.below && <div className="mt-12">{g.below}</div>}
        </section>
      ))}
    </div>
  );
}
