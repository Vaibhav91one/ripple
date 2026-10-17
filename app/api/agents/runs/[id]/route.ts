import { env } from "@/lib/env";
import { NotFound } from "@/lib/graph/queries";
import { SAMPLE_RUN } from "@/lib/approvals/sample";
import { RunDetail } from "@/lib/schemas";
import { handle } from "@/lib/server/route";

/** One run: tool calls with their Cypher and cited sources, the output, and the proposals it made. */
export async function GET(_req: Request, route: { params: Promise<{ id: string }> }) {
  const { id } = await route.params;
  return handle(RunDetail, async (ctx) => {
    if (ctx.viewer.kind === "anon" && id === SAMPLE_RUN.run.id) return SAMPLE_RUN;
    if (!env().DATABASE_URL || !/^[0-9a-f-]{36}$/i.test(id)) throw new NotFound("run not found");
    const { getRun } = await import("@/lib/approvals/service");
    const run = await getRun(ctx.org.id, id, { kind: ctx.viewer.kind, role: ctx.viewer.role });
    if (!run) throw new NotFound("run not found");
    void ctx.audit({ action: "runs.get", resourceType: "agent_run", resourceId: id, read: true });
    return run;
  });
}
