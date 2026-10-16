"use client";

import { TeamFrame, TeamState, Widget } from "../TeamFrame";
import { useTeamDashboard } from "../useTeamDashboard";

// Leadership workspace. The frame, KPIs and Ripple angle are shared; this team's own widgets go inside TeamFrame.
export function LeadershipDashboard() {
  const q = useTeamDashboard("leadership");
  if (!q.data) return <TeamState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  return (
    <TeamFrame title="Leadership" subtitle="Goals, risks and cross-team blockers" kpis={d.kpis} angle={d.angle} teamName="Leadership">
      <Widget title="Workspace" wide>
        <p className="text-sm text-faint">Leadership widgets land here.</p>
      </Widget>
    </TeamFrame>
  );
}
