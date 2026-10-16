"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import SidebarNav, { type SidebarItem } from "@/components/kit/beautifului/sidebar-nav";
import { SearchField } from "@/components/kit/beautifului/search";
import { useDecisionId } from "@/components/ripple/useDecisionId";
import { getDecisions, getRipple } from "@/lib/api";

const pill = (n: number, cls: string, label: string) => (
  <span
    title={`${n} ${label}`}
    className={`flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[10.5px] font-semibold tabular-nums ${cls}`}
  >
    {n}
  </span>
);

/** Decision list for the shell's left slot: search, Open / Resolved sections, `?d=` selection. */
export function DecisionSidebar() {
  const [d, setD] = useDecisionId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false); // narrow screens only
  const { data: decisions = [] } = useQuery({ queryKey: ["decisions"], queryFn: getDecisions });
  // conflict / gap counts come from each decision's ripple; decisions without one just show no badge
  const counts = useQueries({
    queries: decisions.map((x) => ({ queryKey: ["ripple", x.id], queryFn: () => getRipple(x.id), retry: false })),
  });

  const items: SidebarItem[] = decisions
    .map((x, i) => ({ x, c: counts[i]?.data?.counts }))
    .filter(({ x }) => x.title.toLowerCase().includes(query.trim().toLowerCase()))
    .map(({ x, c }) => ({
      key: x.id,
      label: x.title,
      icon: "spaces",
      section: x.status === "superseded" ? "Resolved" : "Open decisions",
      badge: c && (
        <span className="flex shrink-0 items-center gap-1">
          {c.conflicts > 0 && pill(c.conflicts, "bg-conflict-soft text-conflict", "open conflicts")}
          {c.notTold > 0 && pill(c.notTold, "bg-gap-soft text-gap", "teams not told")}
        </span>
      ),
    }))
    .sort((a, b) => Number(a.section === "Resolved") - Number(b.section === "Resolved"));

  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="decision-list"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 items-center justify-center text-faint hover:text-strong md:hidden"
      >
        <span className="sr-only">{open ? "Collapse" : "Expand"} decisions</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <nav id="decision-list" aria-label="Decisions" className={`p-2 ${open ? "max-md:absolute max-md:left-0 max-md:top-10 max-md:z-20 max-md:w-65 max-md:border max-md:border-hairline max-md:bg-surface" : "max-md:hidden"}`}>
        <SidebarNav
          className="w-full"
          items={items}
          active={d}
          onSelect={setD}
          header={null}
          action={null}
          search={
            <div className="mb-2 overflow-hidden rounded-lg bg-page shadow-[var(--kit-shadow-hairline)]">
              <SearchField value={query} onChange={setQuery} placeholder="Search decisions…" className="h-8 border-b-0" />
            </div>
          }
        />
        {items.length === 0 && <p className="px-2 py-3 text-sm text-faint">No decisions match.</p>}
      </nav>
    </div>
  );
}
