"use client";

import { m, useReducedMotion } from "motion/react";
import { Children } from "react";
import { duration, ease, sec, stagger } from "@/lib/motion";

export function CardEnter({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return Children.map(children, (child, i) => (
    <m.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : sec(duration.enter), delay: reduce ? 0 : sec(i * stagger.card), ease: ease.enter }}
    >
      {child}
    </m.div>
  ));
}
