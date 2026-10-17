// Run one approved action exactly once. The row lock serialises concurrent workers; only status "approved" runs.
import { eq } from "drizzle-orm";
import { db } from "../db";
import { orgs, pendingActions } from "../db/schema";
import { audit } from "../audit";
import { safeMessage } from "../log";
import { graphFor, type Graph } from "../graph/client";
import { EXECUTORS } from "./executors";

/** ponytail: the executor runs inside the row-lock transaction, so a slow connector call holds a pooled connection. Add a claim column if that bites. `graph` is a test seam. */
export async function executeAction(id: string, graph?: Graph): Promise<"executed" | "failed" | "skipped"> {
  return db().transaction(async (tx) => {
    const [row] = await tx.select().from(pendingActions).where(eq(pendingActions.id, id)).for("update");
    if (!row || row.status !== "approved") return "skipped";
    const actor = { org: { id: row.orgId }, viewer: { kind: "system" } };
    const res = { resourceType: "action", resourceId: id };
    try {
      const run = EXECUTORS[row.kind as keyof typeof EXECUTORS];
      if (!run) throw new Error(`no executor for ${row.kind}`);
      const [org] = await tx.select().from(orgs).where(eq(orgs.id, row.orgId));
      if (!org && !graph) throw new Error("unknown org");
      const g = graph ?? (await graphFor(org.graphName));
      const result = await run(row.payload, { org: { id: row.orgId }, now: Math.floor(Date.now() / 1000), writer: () => g, approver: row.approver, runId: row.runId });
      await tx.update(pendingActions).set({ status: "executed", result: result ?? null }).where(eq(pendingActions.id, id));
      await audit(actor, { action: "action.executed", ...res, meta: { kind: row.kind } });
      return "executed";
    } catch (e) {
      await tx.update(pendingActions).set({ status: "failed", error: safeMessage(e) }).where(eq(pendingActions.id, id));
      await audit(actor, { action: "action.failed", ...res, meta: { kind: row.kind, error: safeMessage(e) } });
      return "failed";
    }
  });
}
