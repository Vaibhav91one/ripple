import { z } from "zod";
import { env } from "@/lib/env";
import { SAMPLE_APPROVALS } from "@/lib/approvals/sample";
import { ApprovalList } from "@/lib/schemas";
import { bad, handle, params } from "@/lib/server/route";

const NO_DB = "Postgres isn't configured, so there are no proposals to review.";

/** Pending (and failed) actions the viewer's role may decide; `scope=decided` lists the history. Anonymous demo viewers get a read-only list, or a sample. */
export function GET(req: Request) {
  const q = params(req, z.object({ scope: z.enum(["open", "decided"]).default("open"), change: z.string().min(1).optional() }));
  if (bad(q)) return q;
  return handle(ApprovalList, async (ctx) => {
    const only = <T extends { approvals: { changeId: string | null }[]; open: number }>(l: T): T => (q.change ? { ...l, approvals: l.approvals.filter((a) => a.changeId === q.change) } : l); // one change's rows; `open` stays the viewer's total
    const anon = ctx.viewer.kind === "anon";
    if (!env().DATABASE_URL) return only(anon && q.scope === "open" ? SAMPLE_APPROVALS : { approvals: [], open: 0, note: NO_DB });
    const { listApprovals } = await import("@/lib/approvals/service");
    const { rows, open } = await listApprovals(ctx.org.id, { kind: ctx.viewer.kind, id: ctx.viewer.kind === "user" ? ctx.viewer.userId : undefined, role: ctx.viewer.role }, q.scope);
    void ctx.audit({ action: "approvals.list", resourceType: "action", read: true });
    return only(anon && !rows.length && q.scope === "open" ? SAMPLE_APPROVALS : { approvals: rows, open });
  });
}
