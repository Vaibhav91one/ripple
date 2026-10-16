// Offline team dashboards and overview, built from the Ledgerly mocks with the same pure builders the routes use.
import type { Overview, RippleAngle } from "@/lib/schemas";
import { TEAM_IDS, type TeamDashboard, type TeamId } from "@/lib/teams/dashboards";
import { buildDevRel } from "@/lib/teams/devrel/schema";
import { buildEng } from "@/lib/teams/eng/schema";
import { buildLeadership } from "@/lib/teams/leadership/schema";
import { buildLegal } from "@/lib/teams/legal/schema";
import { buildSales } from "@/lib/teams/sales/schema";
import { buildSecurity } from "@/lib/teams/security/schema";
import { buildSupport } from "@/lib/teams/support/schema";
import { activitySeries } from "@/lib/teams/util";
import * as m from "./ledgerly";
import * as v2 from "./ledgerly-v2";

const angle = (team: TeamId): RippleAngle => {
  const t = m.rippleResult.teams.find((x) => x.teamId === team);
  return {
    decisionId: "d-1", affected: !!t || team === "eng", involved: team === "eng" || !!t?.involved, acked: !!t?.acked,
    changes: m.changes, facts: (t?.why ?? []).slice(0, 3).map((w) => ({ text: w.reason, source: w.source })),
  };
};
const people = (team: string) => m.people.filter((p) => p.teamId === team);
const tasksOf = (team: string) => v2.tasks.filter((t) => t.teamId === team);

export function mockTeamDashboard(team: TeamId): TeamDashboard {
  const a = angle(team), now = v2.NOW;
  switch (team) {
    case "eng":
      return buildEng({ prs: v2.prRows, incidents: v2.incidents, services: m.systems, people: people(team) }, a, now);
    case "support":
      return buildSupport({ tickets: v2.ticketRows, customers: [...m.customers, m.v2Customer], people: people(team) }, a, now);
    case "sales":
      return buildSales({ deals: v2.deals, goals: v2.goals.filter((g) => g.ownerTeamId === "sales" && g.target != null), people: people(team) }, a, now);
    case "legal":
      return buildLegal({ contracts: v2.contracts, clauses: v2.clauses, people: people(team) }, a, now);
    case "security":
      return buildSecurity({
        controls: v2.controls, frameworks: v2.frameworks, findings: v2.findings, vendors: v2.vendors, risks: v2.risks,
        tasks: tasksOf(team).filter((t) => t.kind === "questionnaire" || t.kind === "access_review"), people: people(team),
      }, a, now);
    case "devrel":
      return buildDevRel({ pages: v2.pages, docsStats: v2.docsStats, sdks: m.systems.filter((s) => s.id.startsWith("sdk-")), tasks: tasksOf(team), people: people(team) }, a, now);
    case "leadership":
      return buildLeadership({
        goals: v2.goals, risks: v2.risks, blockers: v2.blockers.map(({ fromId, toId, since }) => ({ fromId, toId, since })),
        decisions: m.decisions, people: people(team),
      }, a, now);
  }
}

export function mockOverview(): Overview {
  const r = m.rippleResult, now = v2.NOW;
  const told = (id: string) => id === "eng" || !r.teams.some((t) => t.teamId === id) || r.teams.some((t) => t.teamId === id && (t.involved || t.acked));
  return {
    now,
    kpis: [
      { id: "teams-affected", label: "Teams affected", value: r.counts.teamsAffected, unit: "count" },
      { id: "not-told", label: "Teams not told", value: r.counts.notTold, unit: "count", tone: "bad" },
      { id: "conflicts", label: "Open conflicts", value: r.counts.conflicts, unit: "count", tone: "bad" },
      { id: "arr-at-risk", label: "ARR at risk", value: r.counts.arrAtRisk, unit: "usd", tone: "bad" },
      { id: "customers", label: "Customers on API v1", value: r.counts.customers, unit: "count", tone: "warn" },
    ],
    openDecisions: [{ decision: r.decision, notTold: r.gap }],
    blockers: v2.blockers.map(({ fromId, toId, since }) => ({ fromId, toId, since })),
    recentChanges: m.changes,
    activity: activitySeries([...m.edges, ...v2.edges].map((e) => ({ type: e.type, at: e.validFrom })), now),
    whoKnows: m.whoKnows["api-v1"],
    teams: TEAM_IDS.map((id) => ({
      teamId: id, name: m.teams.find((t) => t.id === id)!.name, people: people(id).length,
      affected: id === "eng" || r.teams.some((t) => t.teamId === id), told: told(id),
    })),
  };
}
