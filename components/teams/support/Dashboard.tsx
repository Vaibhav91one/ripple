"use client";

import { TeamFrame, TeamState, Widget } from "../TeamFrame";
import { useTeamDashboard } from "../useTeamDashboard";

// Support workspace. The frame, KPIs and Ripple angle are shared; this team's own widgets go inside TeamFrame.
export function SupportDashboard() {
  const q = useTeamDashboard("support");
  if (!q.data) return <TeamState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  return (
    <TeamFrame title="Support" subtitle="Queue, SLAs and customer health" kpis={d.kpis} angle={d.angle} teamName="Support">
      <Widget title="Workspace" wide>
        <p className="text-sm text-faint">Support widgets land here.</p>
      </Widget>
    </TeamFrame>
  );
}
