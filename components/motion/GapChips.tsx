"use client";

import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { duration, ease, sec } from "@/lib/motion";

export type GapChip = { id: string; label: string };

export function GapChips({ chips, renderChip }: { chips: GapChip[]; renderChip?: (chip: GapChip) => React.ReactNode }) {
  const reduce = useReducedMotion();
  const d = reduce ? 0 : sec(duration.exit);
  return (
    <ul className="flex flex-wrap items-center gap-2">
      <AnimatePresence initial={false} mode="popLayout">
        {chips.map((c) => (
          <m.li
            key={c.id}
            layout={reduce ? false : "position"}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1, transition: { duration: d, ease: ease.enter } }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: d, ease: ease.exit } }}
            transition={{ duration: d, ease: ease.enter }}
          >
            {renderChip ? renderChip(c) : c.label}
          </m.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
