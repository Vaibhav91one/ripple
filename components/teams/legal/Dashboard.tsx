"use client";

import { TeamFrame, TeamState, Widget } from "../TeamFrame";
import { useTeamDashboard } from "../useTeamDashboard";

// Legal workspace. The frame, KPIs and Ripple angle are shared; this team's own widgets go inside TeamFrame.
export function LegalDashboard() {
  const q = useTeamDashboard("legal");
  if (!q.data) return <TeamState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  return (
    <TeamFrame title="Legal" subtitle="Contracts, renewals, obligations and clause risk" kpis={d.kpis} angle={d.angle} teamName="Legal">
      <Widget title="Workspace" wide>
        <p className="text-sm text-faint">Legal widgets land here.</p>
      </Widget>
    </TeamFrame>
  );
}
