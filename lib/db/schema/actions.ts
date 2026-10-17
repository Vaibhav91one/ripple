import { boolean, index, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const ACTION_STATUSES = ["pending", "approved", "rejected", "executed", "failed", "expired"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

// no FK to orgs or runs: the approval trail outlives both (like audit_log)
export const pendingActions = pgTable(
  "pending_action",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    runId: uuid("run_id"),
    kind: text("kind").notNull(),
    payload: jsonb("payload").notNull(),
    evidence: jsonb("evidence").notNull().default([]),
    status: text("status", { enum: ACTION_STATUSES }).notNull().default("pending"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    approver: text("approver"), // user id, or "policy" when auto-approved
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    result: jsonb("result"),
    error: text("error"),
  },
  (t) => [index("pending_action_org_status_idx").on(t.orgId, t.status)],
);

export const orgPolicy = pgTable(
  "org_policy",
  {
    orgId: text("org_id").notNull(),
    actionKind: text("action_kind").notNull(),
    autoApprove: boolean("auto_approve").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.actionKind] })],
);
