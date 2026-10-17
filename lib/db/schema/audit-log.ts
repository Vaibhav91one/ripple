import { bigserial, index, jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const auditActorType = pgEnum("audit_actor_type", ["user", "apikey", "anon", "agent", "system"]);
export const auditOutcome = pgEnum("audit_outcome", ["allow", "deny"]);

// no FK to orgs: the log must outlive a deleted org
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    orgId: text("org_id").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    actorType: auditActorType("actor_type").notNull(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    outcome: auditOutcome("outcome").notNull(),
    meta: jsonb("meta"),
  },
  (t) => [index("audit_log_org_at_idx").on(t.orgId, t.at)],
);
