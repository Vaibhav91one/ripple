// Audit log: who did what. Writes are awaited, reads fire-and-forget (`read: true`); a DB failure never fails the request.
// With no DATABASE_URL (the demo before Postgres) this is a silent no-op.
import { env } from "./env";

export type AuditEvent = {
  action: string;
  resourceType?: string;
  resourceId?: string;
  outcome?: "allow" | "deny";
  meta?: Record<string, unknown>;
  /** A read-only event (tool call): callers don't await it, and anonymous demo traffic is skipped. */
  read?: boolean;
};
export type AuditCtx = { org: { id: string }; viewer: { kind: string; id?: string } };

const ACTORS = ["user", "apikey", "anon", "agent", "system"] as const;
let lastError = 0;

/** Never rejects. */
export async function audit(ctx: AuditCtx, ev: AuditEvent): Promise<void> {
  const actor = ACTORS.find((a) => a === ctx.viewer.kind) ?? "anon";
  if (!env().DATABASE_URL || (ev.read && actor === "anon")) return;
  try {
    const [{ db }, { auditLog }] = await Promise.all([import("./db"), import("./db/schema")]);
    await db().insert(auditLog).values({
      orgId: ctx.org.id, actorType: actor, actorId: ctx.viewer.id, action: ev.action,
      resourceType: ev.resourceType, resourceId: ev.resourceId, outcome: ev.outcome ?? "allow", meta: ev.meta,
    });
  } catch (e) {
    if (Date.now() - lastError > 60_000) console.error("audit log write failed:", e instanceof Error ? e.message : e); // one line a minute at most
    lastError = Date.now();
  }
}
