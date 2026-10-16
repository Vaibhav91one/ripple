"use client";

import { TeamFrame, TeamState, Widget } from "../TeamFrame";
import { useTeamDashboard } from "../useTeamDashboard";

// DevRel workspace. The frame, KPIs and Ripple angle are shared; this team's own widgets go inside TeamFrame.
export function DevrelDashboard() {
  const q = useTeamDashboard("devrel");
  if (!q.data) return <TeamState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  return (
    <TeamFrame title="DevRel" subtitle="Docs, search and SDK adoption" kpis={d.kpis} angle={d.angle} teamName="DevRel">
      <Widget title="Workspace" wide>
        <p className="text-sm text-faint">DevRel widgets land here.</p>
      </Widget>
    </TeamFrame>
  );
}
