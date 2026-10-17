"use client";

import { KpiCard } from "@/components/kit/obsidian/analytics/kpi-card";
import { PageHeader } from "@/components/shell/PageHeader";
import { GraphDownBanner, LoadingBlock } from "@/components/states/States";
import { GraphDownError } from "@/lib/api";
import type { Kpi, RippleAngle as Angle, RestrictedSummary } from "@/lib/schemas";
import { restrictedLine } from "@/lib/permissions/classify";
import { formatKpi } from "./format";
import { RippleAngle } from "./RippleAngle";

/**
 * Every team workspace: header, a KPI row of four, the team's own widgets, and the Ripple angle on the right.
 * Team dashboards pass their widgets as children, laid out in a 2-column grid (use `col-span-2` for full width).
 */
export function TeamFrame({
  title,
  subtitle,
  kpis,
  angle,
  restricted = [],
  teamName,
  actions,
  children,
}: {
  title: string;
  subtitle: string;
  kpis: Kpi[];
  angle: Angle;
  /** what the server withheld from this viewer */
  restricted?: RestrictedSummary[];
  teamName: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const hidden = restricted.filter((r) => r.kind !== "source"); // payload this viewer may not see
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 p-6">
      <PageHeader title={title} subtitle={subtitle}>{actions}</PageHeader>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Key numbers">
        {kpis.slice(0, 4).map((k, i) => (
          <KpiCard key={k.id} label={k.label} value={k.value} format={(v) => formatKpi(k.unit, v)} index={i} />
        ))}
      </section>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        {hidden.length > 0 ? (
          <section className="flex min-w-0 flex-col gap-2 rounded-lg border border-hairline bg-surface p-4" aria-label="Restricted">
            <h2 className="text-sm font-semibold text-strong">Details are restricted</h2>
            <ul className="flex flex-col gap-1 text-sm text-faint">
              {hidden.map((r) => (
                <li key={r.owner + r.kind}>{restrictedLine(r)}{r.total ? ` (${formatKpi("usd", r.total)} total)` : ""}</li>
              ))}
            </ul>
          </section>
        ) : (
          <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">{children}</div>
        )}
        <div className="xl:sticky xl:top-6 xl:self-start">
          <RippleAngle angle={angle} teamName={teamName} />
        </div>
      </div>
    </div>
  );
}

/** A titled widget card inside the frame. */
export function Widget({ title, meta, wide, children }: { title: string; meta?: React.ReactNode; wide?: boolean; children: React.ReactNode }) {
  return (
    <section className={`flex min-w-0 flex-col gap-3 rounded-lg border border-hairline bg-surface p-4 ${wide ? "lg:col-span-2" : ""}`}>
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-strong">{title}</h2>
        {meta && <div className="text-xs text-faint">{meta}</div>}
      </header>
      {children}
    </section>
  );
}

/** Loading / graph-down / error states shared by every team page. */
export function TeamState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  if (!error) return <div className="p-6"><LoadingBlock label="Loading the workspace" /></div>;
  if (error instanceof GraphDownError) return <div className="p-6"><GraphDownBanner onRetry={onRetry} /></div>;
  return <p className="p-6 text-sm text-conflict">Could not load this workspace.</p>;
}
