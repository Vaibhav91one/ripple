"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { StatusPill } from "@/components/kit/obsidian/analytics/status-pill";
import { SourceChip } from "@/components/ripple/TeamCard";
import type { RippleAngle as Angle } from "@/lib/schemas";
import { fmtDay } from "./format";
import { useNames } from "./useTeamDashboard";

/** Ripple's side of every team page: what the open decision means for this team, who knows, and the sources. */
export function RippleAngle({ angle, teamName }: { angle: Angle; teamName: string }) {
  const name = useNames();
  const status = !angle.affected
    ? { tone: "neutral" as const, label: "Not affected" }
    : angle.acked || angle.involved
      ? { tone: "covered" as const, label: angle.acked ? "Acknowledged" : "Involved" }
      : { tone: "gap" as const, label: "Not told" };
  return (
    <aside className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-4" aria-label={`What changes mean for ${teamName}`}>
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-strong">Changes affecting {teamName}</h2>
        <StatusPill tone={status.tone} label={status.label} />
      </header>
      <Link href={`/decisions/${angle.decisionId}`} className="group flex items-center justify-between rounded-md border border-hairline bg-raised px-3 py-2 text-sm text-strong hover:border-ripple transition-colors">
        <span>{name(angle.decisionId)}</span>
        <ArrowUpRight className="size-4 text-faint group-hover:text-ripple transition-colors" aria-hidden />
      </Link>
      {angle.facts.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-faint">Why it reaches you</h3>
          <ul className="flex flex-col gap-2">
            {angle.facts.map((f, i) => (
              <li key={i} className="flex flex-col gap-1.5 text-sm text-body">
                <p>{f.text}</p>
                <span className="self-start"><SourceChip artifactId={f.source.artifactId} quote={f.source.quote} /></span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {angle.changes.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-faint">Recent changes</h3>
          <ul className="flex flex-col gap-1.5">
            {angle.changes.slice(0, 5).map((c, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 text-xs">
                <span className="min-w-0 truncate text-body">
                  {name(c.edge.from)} <span className="font-mono text-faint">{c.edge.type}</span> {name(c.edge.to)}
                </span>
                <span className="shrink-0 text-faint">{c.kind === "ended" ? "ended" : "added"} {fmtDay(c.at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
