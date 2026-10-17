import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// append-only; no FK to orgs so the log outlives a deleted org (like audit_log)
export const events = pgTable(
  "event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    type: text("type").notNull(),
    subjectKind: text("subject_kind").notNull(),
    subjectId: text("subject_id").notNull(),
    payload: jsonb("payload").notNull(),
    dedupeKey: text("dedupe_key").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("event_org_created_idx").on(t.orgId, t.createdAt)],
);
