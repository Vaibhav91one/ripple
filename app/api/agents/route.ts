import { env } from "@/lib/env";
import { listAgents } from "@/lib/approvals/service";
import { AgentList } from "@/lib/schemas";
import { handle } from "@/lib/server/route";

/** The roster from the agent registry, with this org's switch, auto-approve flags and last run. Without Postgres: the registry alone. */
export function GET() {
  return handle(AgentList, async (ctx) => {
    const live = !!env().DATABASE_URL;
    void ctx.audit({ action: "agents.list", resourceType: "agent", read: true });
    return {
      canEdit: live && ctx.viewer.kind === "user" && ctx.viewer.role === "admin",
      agents: await listAgents(live ? ctx.org.id : null),
      ...(live ? {} : { note: "Postgres isn't configured, so runs and settings aren't available." }),
    };
  });
}
