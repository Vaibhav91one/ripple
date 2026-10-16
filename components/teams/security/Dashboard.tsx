"use client";

import { TeamFrame, TeamState, Widget } from "../TeamFrame";
import { useTeamDashboard } from "../useTeamDashboard";

// Security workspace. The frame, KPIs and Ripple angle are shared; this team's own widgets go inside TeamFrame.
export function SecurityDashboard() {
  const q = useTeamDashboard("security");
  if (!q.data) return <TeamState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  return (
    <TeamFrame title="Security" subtitle="Controls, frameworks, findings and vendor risk" kpis={d.kpis} angle={d.angle} teamName="Security">
      <Widget title="Workspace" wide>
        <p className="text-sm text-faint">Security widgets land here.</p>
      </Widget>
    </TeamFrame>
  );
}
