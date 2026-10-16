"use client";

import { TeamFrame, TeamState, Widget } from "../TeamFrame";
import { useTeamDashboard } from "../useTeamDashboard";

// Engineering workspace. The frame, KPIs and Ripple angle are shared; this team's own widgets go inside TeamFrame.
export function EngDashboard() {
  const q = useTeamDashboard("eng");
  if (!q.data) return <TeamState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  return (
    <TeamFrame title="Engineering" subtitle="Pull requests, delivery and incidents" kpis={d.kpis} angle={d.angle} teamName="Engineering">
      <Widget title="Workspace" wide>
        <p className="text-sm text-faint">Engineering widgets land here.</p>
      </Widget>
    </TeamFrame>
  );
}
