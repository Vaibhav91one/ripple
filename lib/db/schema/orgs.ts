import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const orgs = pgTable("orgs", {
  id: text("id").primaryKey(), // Clerk org id; 'demo' for the public demo
  slug: text("slug").notNull(),
  graphName: text("graph_name").notNull().unique(),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
