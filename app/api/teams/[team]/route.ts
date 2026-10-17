import { registry, TeamDashboard, TeamId } from "@/lib/teams";
import { latestOpenDecisionId } from "@/lib/teams/run";
import { handle } from "@/lib/server/route";
import { seesSummaries, owns } from "@/lib/permissions/redact";

export async function GET(_req: Request, ctx: { params: Promise<{ team: string }> }) {
  const team = TeamId.safeParse((await ctx.params).team);
  if (!team.success) return Response.json({ error: "not_found", message: "unknown team" }, { status: 404 });
  return handle(TeamDashboard, async ({ graph, now, viewer }) => {
    const p = await registry[team.data](graph, now, await latestOpenDecisionId(graph));
    // KPIs and the forecast are computed from the team's restricted rows: only the owner and leadership (summaries) get them
    if (!owns(viewer, p.team) && !seesSummaries(viewer)) {
      if (p.team === "legal" || p.team === "sales" || p.team === "security") p.kpis = [];
      if (p.team === "sales") p.forecast = { goal: 0, closed: 0, gap: 0, commit: 0, bestCase: 0, weighted: 0 };
    }
    return p;
  });
}
