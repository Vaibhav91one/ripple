// Obsidian UI (obsidianui.dev) Analytics Dashboard, MIT, see ../LICENSE. Restyled to Ripple tokens.
import type { ReactNode } from "react";
import { cx, type Tone } from "./tone";

export function StatusPill({ tone = "neutral", label, icon, className }: { tone?: Tone; label: string; icon?: ReactNode; className?: string }) {
  return (
    <span className={cx("oa oa-pill", className)} data-tone={tone}>
      {icon ?? <i className="oa-pill-dot" aria-hidden="true" />}
      {label}
    </span>
  );
}
