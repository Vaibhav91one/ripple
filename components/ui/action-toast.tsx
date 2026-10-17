"use client";
import { Check, ChevronRight } from "lucide-react";
import { m } from "motion/react";
import { duration, ease, sec } from "@/lib/motion";

export function ActionToast({ title, body, time, action, dismiss, onAction, onDismiss }: {
  title: string; body: string; time: string; action: string; dismiss: string; onAction?: () => void; onDismiss?: () => void;
}) {
  return (
    <m.div
      role="status"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: sec(duration.enter), ease: ease.enter }}
      className="w-[295px] rounded-card border border-hairline bg-surface p-4 shadow-lg"
    >
      <div className="flex gap-3">
        <span className="grid size-[26px] shrink-0 place-items-center rounded-full bg-covered-soft text-covered"><Check aria-hidden className="size-3.5" /></span>
        <div className="min-w-0 space-y-0.5">
          <p className="text-xs font-medium text-strong">{title}</p>
          <p className="text-2xs leading-[17px] text-body">{body}</p>
          <p className="pt-0.5 text-3xs text-faint">{time}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-4">
        <button type="button" onClick={onAction} className="inline-flex items-center gap-1.5 rounded-control bg-strong px-3 py-2 text-xs font-medium text-[var(--accent-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ripple">
          {action}<ChevronRight aria-hidden className="size-3.5" />
        </button>
        <button type="button" onClick={onDismiss} className="rounded-control text-xs font-medium text-strong focus-visible:outline-2 focus-visible:outline-ripple">{dismiss}</button>
      </div>
    </m.div>
  );
}
