import { pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { orgs } from "./orgs";

// Where a team's channel-delivered notifications go (a Slack channel id). Edited on /connectors/slack.
export const teamChannels = pgTable(
  "team_channel",
  {
    orgId: text("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
    teamId: text("team_id").notNull(),
    slackChannelId: text("slack_channel_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.teamId] })],
);
