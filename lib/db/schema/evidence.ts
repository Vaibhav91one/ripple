import { index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

// "Discussed" evidence: a Slack message mentioned a change. Never an acknowledgement (that lives on delivery.acked_at).
// No FK to orgs, like events: it is a log of what was seen.
export const evidence = pgTable(
  "evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    changeId: text("change_id").notNull(),
    teamId: text("team_id"), // author's team, else the team the channel belongs to
    channelId: text("channel_id").notNull(),
    messageTs: text("message_ts").notNull(),
    permalink: text("permalink"),
    authorSlackId: text("author_slack_id"),
    personId: text("person_id"), // graph Person mapped from the Slack author; null = not mapped
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("evidence_msg_change_uq").on(t.orgId, t.changeId, t.channelId, t.messageTs), index("evidence_change_idx").on(t.orgId, t.changeId)],
);
