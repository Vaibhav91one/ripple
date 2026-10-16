"use client";
// Obsidian UI (obsidianui.dev) Analytics Dashboard, MIT, see ../LICENSE. Restyled to Ripple tokens.
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { cx } from "./tone";

export type SegOption<T extends string> = { id: T; label: ReactNode };

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: readonly SegOption<T>[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
}) {
  const index = Math.max(0, options.findIndex((o) => o.id === value));

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].id);
    e.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]")[next]?.focus();
  }

  return (
    <div
      className={cx("oa oa-seg", className)}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      style={{ "--n": options.length, "--idx": index } as CSSProperties}
    >
      <span className="oa-seg-thumb" aria-hidden="true" />
      {options.map((o) => {
        const checked = o.id === value;
        return (
          <button key={o.id} type="button" role="radio" aria-checked={checked} tabIndex={checked ? 0 : -1} className="oa-seg-btn" onClick={() => onChange(o.id)}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
