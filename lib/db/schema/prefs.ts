import { boolean, jsonb, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { orgs } from "./orgs";

/** Per-urgency channel lists, e.g. `{"high":["slack_dm","email","inbox"]}`. A missing urgency inherits. */
export type ChannelPrefs = Partial<Record<"high" | "normal" | "low", ("slack_dm" | "email" | "inbox")[]>>;

// Every column except the keys is nullable: null = inherit from the org default, then the system default.
export const preferences = pgTable(
  "preference",
  {
    orgId: text("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    personId: text("person_id"), // the graph Person this user is; route() looks prefs up by it
    tz: text("tz"),
    quietStart: text("quiet_start"), // HH:MM local; start == end means no quiet hours
    quietEnd: text("quiet_end"),
    channels: jsonb("channels").$type<ChannelPrefs>(),
    digest: boolean("digest"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.orgId, t.userId)],
);

export const orgNotifyDefaults = pgTable("org_notify_default", {
  orgId: text("org_id").primaryKey().references(() => orgs.id, { onDelete: "cascade" }),
  channels: jsonb("channels").$type<ChannelPrefs>(),
  tz: text("tz"), // the zone org quiet hours are read in (people can set their own)
  quietStart: text("quiet_start"),
  quietEnd: text("quiet_end"),
  digestDay: text("digest_day"), // mon..sun, or 'off'
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
