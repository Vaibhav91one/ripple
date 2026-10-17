// SakaniUI (sakaniui.com), MIT, see ./LICENSE. Restyled to Ripple tokens.
// Ported from SakaniUI Tabs (label/md 14/20 500, active strong + 2px sliding underline, muted inactive); the search field
// at the right and the 8px tab padding follow the CRM dashboard screenshot.
"use client";
import { m, useReducedMotion } from "motion/react";
import { Search } from "lucide-react";
import { useId } from "react";

export type TabItem = { value: string; label: string };

export function UnderlineTabs({ items, value, onChange, searchPlaceholder }: {
  items: TabItem[]; value: string; onChange?: (v: string) => void; searchPlaceholder?: string;
}) {
  const id = useId();
  const reduce = useReducedMotion();
  return (
    <div className="flex items-end justify-between gap-4">
      <div role="tablist" className="flex gap-2.5">
        {items.map((t) => {
          const on = t.value === value;
          return (
            <button key={t.value} role="tab" type="button" aria-selected={on} onClick={() => onChange?.(t.value)}
              className={`relative px-2 pb-[10px] text-[14px] leading-5 font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-ripple ${on ? "text-strong" : "text-faint hover:text-strong"}`}>
              {t.label}
              {on && <m.span aria-hidden layoutId={id} transition={{ duration: reduce ? 0 : 0.2 }} className="absolute inset-x-0 bottom-0 h-0.5 rounded-[1px] bg-ripple" />}
            </button>
          );
        })}
      </div>
      {searchPlaceholder && (
        <label className="flex h-[34px] w-[260px] shrink-0 items-center gap-2 rounded-[10px] border border-hairline px-3 text-faint focus-within:border-body">
          <Search size={16} strokeWidth={1.5} aria-hidden />
          <input type="search" placeholder={searchPlaceholder} aria-label={searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent text-[14px] text-strong outline-none placeholder:text-faint" />
        </label>
      )}
    </div>
  );
}
