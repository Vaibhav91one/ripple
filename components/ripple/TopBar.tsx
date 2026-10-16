"use client";

import { useQuery } from "@tanstack/react-query";
import { parseAsString, useQueryState } from "nuqs";
import { getDecisions } from "@/lib/api";
import { useDecisionId } from "./useDecisionId";

export function TopBar() {
  const [d] = useDecisionId();
  const [, setAsk] = useQueryState("ask", parseAsString);
  const { data } = useQuery({ queryKey: ["decisions"], queryFn: getDecisions });
  const title = data?.find((x) => x.id === d)?.title;
  return (
    <header className="flex h-12 shrink-0 items-center gap-4 border-b border-hairline bg-surface px-5">
      <span className="flex items-center gap-2 text-md font-medium text-strong">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="var(--ripple)" strokeWidth="1.5" aria-hidden>
          <circle cx="9" cy="9" r="2" fill="var(--ripple)" />
          <circle cx="9" cy="9" r="5.5" opacity=".7" />
          <circle cx="9" cy="9" r="8.25" opacity=".4" />
        </svg>
        Ripple
      </span>
      <span className="h-4 w-px bg-hairline" />
      <span className="truncate text-sm text-body">{title ?? " "}</span>
      <div data-slot="team-tabs" className="flex flex-1 items-center gap-1" />
      <button
        onClick={() => setAsk("1")}
        className="h-8 rounded-lg bg-ripple-soft px-3 text-sm font-medium text-ripple transition-colors hover:bg-ripple/25"
      >
        Ask
      </button>
    </header>
  );
}
