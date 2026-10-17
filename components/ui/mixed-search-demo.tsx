"use client";
// Type to filter, arrow up/down to move the highlight (wraps), as in a command palette.
import { useState, type ComponentProps } from "react";
import { MixedSearch } from "./mixed-search";

export function MixedSearchDemo({ groups, ...rest }: Omit<ComponentProps<typeof MixedSearch>, "activeId" | "query" | "onQuery" | "onKeyDown">) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const shown = groups.map((g) => ({ ...g, rows: g.rows.filter((r) => r.label.toLowerCase().includes(query.toLowerCase())) })).filter((g) => g.rows.length);
  const ids = shown.flatMap((g) => g.rows.map((r) => r.id));
  const at = ids.length ? Math.min(active, ids.length - 1) : 0;
  return (
    <MixedSearch {...rest} groups={shown} activeId={ids[at]} query={query}
      onQuery={(q) => { setQuery(q); setActive(0); }}
      onKeyDown={(e) => {
        if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
        e.preventDefault();
        setActive((at + (e.key === "ArrowDown" ? 1 : -1) + ids.length) % Math.max(ids.length, 1));
      }} />
  );
}
