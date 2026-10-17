"use client";
// Unified search as a command palette: input with a shortcut hint, then labelled groups of rows with icon tiles.
import type { KeyboardEvent } from "react";
import { Gavel, KeyRound, Music, Database, Search, Server, SlidersHorizontal, Smile, Sparkles, SquarePlus, StickyNote, TreePine, Users, Scale, FileText, X, type LucideIcon } from "lucide-react";

const ICONS = {
  x: X, "note-plus": SquarePlus, music: Music, smile: Smile, doc: FileText, sticky: StickyNote, tree: TreePine,
  gavel: Gavel, server: Server, key: KeyRound, users: Users, scale: Scale, database: Database, sparkles: Sparkles,
} satisfies Record<string, LucideIcon>;
export type IconName = keyof typeof ICONS;
const TONES = {
  plain: "bg-raised text-strong", red: "bg-conflict text-strong", ripple: "bg-ripple-soft text-ripple", gap: "bg-gap-soft text-gap", covered: "bg-covered-soft text-covered",
};
export type RowTone = keyof typeof TONES;
export interface SearchRow { id: string; label: string; icon: IconName; tone: RowTone; meta?: string }
export interface SearchGroup { label: string; rows: SearchRow[] }

export function MixedSearch({ placeholder, hint, groups, activeId, query, onQuery, onKeyDown, label }: {
  placeholder: string; hint: string; groups: SearchGroup[]; label: string;
  /** Highlighted row (keyboard focus). */
  activeId?: string;
  query?: string; onQuery?: (q: string) => void; onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
}) {
  const interactive = !!onQuery;
  return (
    <div role="search" aria-label={label} className="mx-auto w-full max-w-[380px] rounded-[var(--ref-radius)] border border-hairline bg-surface p-2.5 text-strong">
      <div className="flex items-center gap-2">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-raised px-3.5 text-faint focus-within:ring-2 focus-within:ring-ripple">
          <Search size={17} aria-hidden />
          <input type="text" aria-label={placeholder} placeholder={placeholder} value={query} readOnly={!interactive} onChange={(e) => onQuery?.(e.target.value)} onKeyDown={onKeyDown}
            role="combobox" aria-expanded aria-controls="mixed-search-list" aria-activedescendant={activeId ? `ms-${activeId}` : undefined}
            className="min-w-0 flex-1 bg-transparent text-md text-strong outline-none placeholder:text-faint" />
          <kbd className="rounded-control bg-hairline px-1.5 py-0.5 font-mono text-xs text-body">{hint}</kbd>
        </label>
        <button type="button" aria-label="Filter" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-raised text-body outline-none focus-visible:ring-2 focus-visible:ring-ripple">
          <SlidersHorizontal size={18} aria-hidden />
        </button>
      </div>
      <ul id="mixed-search-list" role="listbox" aria-label={label} className="mt-1">
        {groups.map((g) => (
          <li key={g.label} role="presentation">
            <p className="px-2.5 pb-1 pt-3 text-md font-medium text-faint">{g.label}</p>
            <ul role="presentation">
              {g.rows.map((r) => {
                const Icon = ICONS[r.icon];
                return (
                  <li key={r.id} id={`ms-${r.id}`} role="option" aria-selected={r.id === activeId}
                    className={`flex min-h-[52px] items-center py-1.5 gap-3.5 rounded-card px-2.5 ${r.id === activeId ? "bg-raised" : ""}`}>
                    <span className={`flex size-9 shrink-0 items-center justify-center rounded-control ${TONES[r.tone]}`}><Icon size={19} aria-hidden /></span>
                    <span className="min-w-0 flex-1 text-md leading-tight">{r.label}</span>
                    {r.meta && <span className="font-mono text-xs text-faint">{r.meta}</span>}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
