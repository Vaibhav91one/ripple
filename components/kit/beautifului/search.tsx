// Beautiful UI (beautifului.dev), MIT, see ./LICENSE. Restyled to Ripple tokens.
"use client";

import "./kit.css";

import { useState } from "react";

/* ─────────────────────────────────────────────────────────
 * SEARCH — command search with live filtering.
 * The field, clear action, and results are directly usable.
 * ───────────────────────────────────────────────────────── */

const ITEMS = [
  "Who does RFC-14 touch",
  "Find promises to Acme",
  "Compare RFC-14 with clause 7.2",
  "Draft the notice to Legal",
  "Check who has not been told",
  "Audit open conflicts",
  "Close covered decisions",
];

/** The input row with clear action; controlled. */
export function SearchField({
  value,
  onChange,
  placeholder = "Search the company brain…",
  label = placeholder,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}) {
  return (
    <div className={`flex h-10 items-center gap-2 border-b border-hairline px-3 transition-colors duration-100 hover:bg-raised ${className}`}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="2" strokeLinecap="round" className="shrink-0">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="min-w-0 flex-1 bg-transparent text-[13px] text-strong outline-none placeholder:text-faint"
      />
      {value && (
        <button
          aria-label="Clear search"
          type="button"
          onClick={() => onChange("")}
          className="flex size-5.5 items-center justify-center rounded-full text-faint
            transition-colors duration-100 hover:bg-overlay/70 hover:text-strong"
          style={{ animation: "fade-in 150ms ease-out both" }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default function SearchList({ items = ITEMS }: { items?: string[] } = {}) {
  const [query, setQuery] = useState("");
  const results = query
    ? items.filter((i) => i.toLowerCase().includes(query.toLowerCase()))
    : items.slice(0, 5);
  const empty = query.length > 2 && results.length === 0;

  return (
    <div className="flex min-h-[248px] w-full max-w-72 flex-col items-stretch">
      <div className="w-full self-start overflow-hidden rounded-xl bg-surface shadow-[var(--kit-shadow-raised)]">
        <SearchField value={query} onChange={setQuery} />

        {/* results / empty state */}
        {empty ? (
          <div className="flex flex-col items-center justify-center gap-1 px-4 py-8" style={{ animation: "fade-in 250ms ease-out both" }}>
            <span className="mb-1.5 flex size-8 items-center justify-center rounded-lg bg-page text-faint shadow-[var(--kit-shadow-hairline)]">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
            </span>
            <span className="text-[13px] font-medium text-strong">No results found</span>
            <span className="text-[12px] text-faint">Adjust your search to try again</span>
          </div>
        ) : (
          <div className="p-1">
            {results.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setQuery(item)}
                className="flex h-8 w-full items-center rounded-[6px] px-2 text-left text-[13px]
                  text-strong transition-colors duration-100 hover:bg-raised"
                style={{ animation: "fade-in 200ms ease-out both" }}
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
