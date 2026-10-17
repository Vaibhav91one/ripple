import { index, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { orgs } from "./orgs";

// A change's Slack room, stored by channel id: names get renamed and slugs aren't ids. Courier (#188) writes a row when it creates a channel.
export const changeChannels = pgTable(
  "change_channel",
  {
    orgId: text("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
    changeId: text("change_id").notNull(),
    slackTeamId: text("slack_team_id").notNull(),
    channelId: text("channel_id").notNull(),
    name: text("name").notNull(), // the name at creation, informational only
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("change_channel_change_uq").on(t.orgId, t.changeId), index("change_channel_channel_idx").on(t.orgId, t.channelId)],
);
