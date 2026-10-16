import { notFound } from "next/navigation";
import { TEAMS, isTeamId } from "@/components/shell/nav";
import { EngDashboard } from "@/components/teams/eng/Dashboard";
import { SupportDashboard } from "@/components/teams/support/Dashboard";
import { SalesDashboard } from "@/components/teams/sales/Dashboard";
import { LegalDashboard } from "@/components/teams/legal/Dashboard";
import { SecurityDashboard } from "@/components/teams/security/Dashboard";
import { DevrelDashboard } from "@/components/teams/devrel/Dashboard";
import { LeadershipDashboard } from "@/components/teams/leadership/Dashboard";

// One workspace per team; each team's dashboard owns its own widgets (components/teams/<team>/).
const DASHBOARDS = {
  eng: EngDashboard,
  support: SupportDashboard,
  sales: SalesDashboard,
  legal: LegalDashboard,
  security: SecurityDashboard,
  devrel: DevrelDashboard,
  leadership: LeadershipDashboard,
} as const;

export function generateStaticParams() {
  return TEAMS.map((t) => ({ team: t.id }));
}

export default async function TeamPage({ params }: PageProps<"/teams/[team]">) {
  const { team } = await params;
  if (!isTeamId(team)) notFound();
  const Dashboard = DASHBOARDS[team];
  return <Dashboard />;
}
