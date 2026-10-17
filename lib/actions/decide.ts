// Approve or reject a pending action. Admin, or the role that owns the action kind. Every outcome is audited.
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { pendingActions } from "../db/schema";
import { audit } from "../audit";
import type { ActionKind } from "../agent/define";
import { OWNER_ROLE } from "./executors";
import { enqueueExecution } from "./propose";

export type DecideCtx = { org: { id: string }; viewer: { kind: string; id?: string; role?: string } };
/** status is the HTTP status a route should answer with. */
export class ActionError extends Error {
  constructor(readonly status: 403 | 404, message: string) { super(message); }
}

async function decide(ctx: DecideCtx, id: string, verb: "approve" | "reject") {
  const d = db();
  const [row] = await d.select().from(pendingActions).where(and(eq(pendingActions.id, id), eq(pendingActions.orgId, ctx.org.id)));
  if (!row) throw new ActionError(404, "action not found");
  const res = { resourceType: "action", resourceId: id };
  const role = ctx.viewer.role;
  if (ctx.viewer.kind !== "user" || !(role === "admin" || role === OWNER_ROLE[row.kind as ActionKind])) {
    await audit(ctx, { action: `action.${verb}`, outcome: "deny", ...res, meta: { kind: row.kind, role } });
    throw new ActionError(403, "not permitted to decide this action");
  }
  const status = verb === "approve" ? "approved" : "rejected";
  // The status guard makes a second decision a no-op: only the first caller wins and enqueues. A failed action may be approved again (retry).
  const [won] = await d.update(pendingActions).set({ status, approver: ctx.viewer.id, decidedAt: new Date(), error: null })
    .where(and(eq(pendingActions.id, id), verb === "approve" ? inArray(pendingActions.status, ["pending", "failed"]) : eq(pendingActions.status, "pending"))).returning({ key: pendingActions.idempotencyKey });
  if (!won) return { id, status: row.status, changed: false };
  await audit(ctx, { action: `action.${status}`, ...res, meta: { kind: row.kind } });
  if (verb === "approve") await enqueueExecution(id, won.key);
  return { id, status, changed: true };
}

export const approve = (ctx: DecideCtx, id: string) => decide(ctx, id, "approve");
export const reject = (ctx: DecideCtx, id: string) => decide(ctx, id, "reject");
