import { index, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { orgs } from "./orgs";

// An ingested source document (upload, Slack thread, PR description). Deduped by content hash per org.
export const documents = pgTable(
  "document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
    sourceKind: text("source_kind").notNull(), // doc | message | ticket | pr
    sourceRef: text("source_ref"), // uri / external id
    title: text("title").notNull(),
    text: text("text").notNull(),
    sha256: text("sha256").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("document_org_sha_uq").on(t.orgId, t.sha256)],
);

// A confirmed name for a graph node ("Acme Inc." -> customer-acme). alias_norm = normalised by lib/ingest/resolve.ts.
export const entityAliases = pgTable(
  "entity_alias",
  {
    orgId: text("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // node label
    aliasNorm: text("alias_norm").notNull(),
    nodeId: text("node_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.kind, t.aliasNorm] }), index("entity_alias_node_idx").on(t.orgId, t.nodeId)],
);
