"use client";

import { useQuery } from "@tanstack/react-query";

type Health = { falkordb: "up" | "down"; llm: "configured" | "fallback" };

// /api/health answers 503 with the same JSON when FalkorDB is down, so parse regardless of status.
const getHealth = async (): Promise<Health> => (await fetch("/api/health")).json();

export function HealthPill() {
  const { data, isError } = useQuery({ queryKey: ["health"], queryFn: getHealth, refetchInterval: 30_000 });
  const up = data?.falkordb === "up";
  return (
    <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-(--obsidian-dashboard-shell-text-muted)" role="status">
      <span aria-hidden className={`size-2 shrink-0 rounded-full ${data ? (up ? "bg-covered" : "bg-conflict") : isError ? "bg-conflict" : "bg-faint"}`} />
      <span className="flex min-w-0 flex-col gap-0.5 leading-tight">
        {data ? (
          <>
            <span>FalkorDB {data.falkordb}</span>
            <span className="text-(--obsidian-dashboard-shell-text-subtle)">LLM {data.llm}</span>
          </>
        ) : (
          isError ? "Health unavailable" : "Checking…"
        )}
      </span>
    </div>
  );
}
