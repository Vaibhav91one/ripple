// An agent never has a side effect: it proposes. The org policy may approve at once; otherwise a person decides.
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { orgPolicy, pendingActions } from "../db/schema";
import { emit } from "../events/emit";
import { enqueue } from "../queue";
import { audit } from "../audit";
import type { ActionKind } from "../agent/define";
import { OWNER_ROLE } from "./executors";

export type ProposeCtx = { org: { id: string }; viewer: { kind: string; id?: string }; runId?: string; /** Background run: a policy-approved action is held (approved, not enqueued) until runBackground validates the run and releases it. */ hold?: boolean };
export type Proposed = { id: string; status: string; created: boolean };

/** Queue the execution once. singletonKey is the idempotency key, so a double approve cannot double-enqueue. */
export const enqueueExecution = (id: string, key: string) => enqueue("execute-action", { id }, { singletonKey: key });

export async function propose(ctx: ProposeCtx, kind: ActionKind, payload: unknown, evidence: unknown = []): Promise<Proposed> {
  const d = db();
  // Same org + kind + payload in the same run is one proposal. ponytail: key follows JSON key order, so reordered payloads are separate proposals.
  const key = createHash("sha256").update(JSON.stringify([ctx.org.id, kind, payload, ctx.runId ?? ""])).digest("hex");
  const [row] = await d.insert(pendingActions).values({ orgId: ctx.org.id, runId: ctx.runId, kind, payload, evidence, idempotencyKey: key })
    .onConflictDoNothing({ target: pendingActions.idempotencyKey }).returning();
  if (!row) {
    const [old] = await d.select().from(pendingActions).where(eq(pendingActions.idempotencyKey, key));
    return { id: old.id, status: old.status, created: false };
  }
  await audit(ctx, { action: "action.proposed", resourceType: "action", resourceId: row.id, meta: { kind } });
  const decisionId = (payload as { decisionId?: unknown } | null)?.decisionId;
  await emit(d, {
    type: "approval.requested", orgId: ctx.org.id, subject: { kind: "action", id: row.id },
    payload: { changeId: typeof decisionId === "string" ? decisionId : row.id, approverId: OWNER_ROLE[kind] },
    dedupeKey: `approval.requested:${row.id}`,
  });
  const [policy] = await d.select().from(orgPolicy).where(and(eq(orgPolicy.orgId, ctx.org.id), eq(orgPolicy.actionKind, kind)));
  if (!policy?.autoApprove) return { id: row.id, status: "pending", created: true };
  await d.update(pendingActions).set({ status: "approved", approver: "policy", decidedAt: new Date() }).where(eq(pendingActions.id, row.id));
  await audit(ctx, { action: "action.approved", resourceType: "action", resourceId: row.id, meta: { kind, by: "policy" } });
  if (!ctx.hold) await enqueueExecution(row.id, key);
  return { id: row.id, status: "approved", created: true };
}
