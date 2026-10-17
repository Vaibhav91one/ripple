import { registry, TeamDashboard, TeamId } from "@/lib/teams";
import { handle } from "@/lib/server/route";

export async function GET(_req: Request, ctx: { params: Promise<{ team: string }> }) {
  const team = TeamId.safeParse((await ctx.params).team);
  if (!team.success) return Response.json({ error: "not_found", message: "unknown team" }, { status: 404 });
  return handle(TeamDashboard, ({ graph, now }) => registry[team.data](graph, now));
}
