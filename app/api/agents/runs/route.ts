import { z } from "zod";
import { env } from "@/lib/env";
import { SAMPLE_RUNS } from "@/lib/approvals/sample";
import { RunList } from "@/lib/schemas";
import { bad, handle, params } from "@/lib/server/route";

/** Latest runs (newest first), optionally one agent's. Anonymous demo viewers see a sample when the org has none. */
export function GET(req: Request) {
  const q = params(req, z.object({ agent: z.string().min(1).optional() }));
  if (bad(q)) return q;
  return handle(RunList, async (ctx) => {
    if (!env().DATABASE_URL) return ctx.viewer.kind === "anon" ? SAMPLE_RUNS : { runs: [], note: "Postgres isn't configured, so runs aren't recorded." };
    const { listRuns } = await import("@/lib/approvals/service");
    void ctx.audit({ action: "runs.list", resourceType: "agent_run", read: true });
    const runs = await listRuns(ctx.org.id, q.agent);
    return ctx.viewer.kind === "anon" && !runs.length ? SAMPLE_RUNS : { runs };
  });
}
