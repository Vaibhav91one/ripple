"use client";

import { TeamFrame, TeamState, Widget } from "../TeamFrame";
import { useTeamDashboard } from "../useTeamDashboard";

// Sales workspace. The frame, KPIs and Ripple angle are shared; this team's own widgets go inside TeamFrame.
export function SalesDashboard() {
  const q = useTeamDashboard("sales");
  if (!q.data) return <TeamState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  return (
    <TeamFrame title="Sales" subtitle="Pipeline, forecast and deal desk" kpis={d.kpis} angle={d.angle} teamName="Sales">
      <Widget title="Workspace" wide>
        <p className="text-sm text-faint">Sales widgets land here.</p>
      </Widget>
    </TeamFrame>
  );
}
