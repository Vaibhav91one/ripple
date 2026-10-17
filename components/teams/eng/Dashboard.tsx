"use client";

import { TeamFrame, TeamState } from "../TeamFrame";
import { useTeamDashboard } from "../useTeamDashboard";
import { CycleBreakdown, IncidentFeed, PrQuality, ReviewTable, Services } from "./Widgets";

// Engineering workspace (GitHub + LinearB + PagerDuty). The frame, KPIs and Ripple angle are shared; widgets live in Widgets.tsx.
export function EngDashboard() {
  const q = useTeamDashboard("eng");
  if (!q.data) return <TeamState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  return (
    <TeamFrame title="Engineering" subtitle="Pull requests, delivery and incidents" kpis={d.kpis} angle={d.angle} restricted={d.restricted} teamName="Engineering">
      <ReviewTable d={d} />
      <CycleBreakdown d={d} />
      <PrQuality d={d} />
      <Services d={d} />
      <IncidentFeed d={d} />
    </TeamFrame>
  );
}
