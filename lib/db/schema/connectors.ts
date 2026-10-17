import { jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { orgs } from "./orgs";

// one row per installed connector account (a GitHub App installation, a Slack workspace, an IdP); token_enc is lib/crypto.ts output
export const connectorAccounts = pgTable(
  "connector_account",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    externalId: text("external_id").notNull(),
    tokenEnc: text("token_enc"),
    scopes: text("scopes").array().notNull().default([]),
    cursor: jsonb("cursor"),
    status: text("status").notNull().default("active"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("connector_account_org_kind_external_uq").on(t.orgId, t.kind, t.externalId)],
);
