import { index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { orgs } from "./orgs";

// Assistant threads for signed-in orgs. The public demo never writes here (the client keeps history in localStorage).
export const conversations = pgTable(
  "conversation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    /** Agent the thread is pinned to (@agent), null = Ask. */
    agent: text("agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("conversation_org_user_idx").on(t.orgId, t.userId, t.updatedAt)],
);

export const messages = pgTable(
  "message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    /** The assistant turn's StreamEvents (tool calls, citations) so a thread replays exactly. */
    events: jsonb("events"),
    agent: text("agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("message_conversation_idx").on(t.conversationId, t.createdAt)],
);

// Demo budget counters. key = "v:<cookie>", "ip:<ip>" or "global"; day = UTC YYYY-MM-DD.
export const usageCounters = pgTable(
  "usage_counter",
  {
    key: text("key").notNull(),
    day: text("day").notNull(),
    prompts: integer("prompts").notNull().default(0),
    tokens: integer("tokens").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.day] })],
);
