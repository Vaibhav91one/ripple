import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { events } from "./events";

export const DELIVERY_CHANNELS = ["slack_dm", "slack_channel", "email"] as const;
export const DELIVERY_STATUSES = ["queued", "sent", "delivered", "clicked", "acked", "failed"] as const;
export type DeliveryChannel = (typeof DELIVERY_CHANNELS)[number];
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

// The in-app inbox copy. One row per person per event; dedupe_key (from route()) makes a replayed event a no-op.
export const notifications = pgTable(
  "notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    personId: text("person_id").notNull(), // graph Person id, as route() returns it
    eventId: uuid("event_id").references(() => events.id),
    kind: text("kind").notNull(), // event type, e.g. task.assigned
    title: text("title").notNull(),
    body: jsonb("body").$type<{ reason: string; subject: { kind: string; id: string } }>().notNull(),
    urgency: text("urgency").$type<"high" | "normal" | "low">().notNull(),
    channels: jsonb("channels").$type<string[]>().notNull().default([]), // what route() chose, inbox included
    batchKey: text("batch_key").notNull(),
    dedupeKey: text("dedupe_key").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => [index("notification_person_idx").on(t.orgId, t.personId, t.createdAt), index("notification_batch_idx").on(t.orgId, t.batchKey)],
);

// One row per external send attempt of a notification on a channel (inbox has none: the notification row is the delivery).
export const deliveries = pgTable(
  "delivery",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    notificationId: uuid("notification_id").notNull().references(() => notifications.id, { onDelete: "cascade" }),
    channel: text("channel").$type<DeliveryChannel>().notNull(),
    status: text("status").$type<DeliveryStatus>().notNull().default("queued"),
    providerId: text("provider_id"),
    error: text("error"),
    queuedAt: timestamp("queued_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    clickedAt: timestamp("clicked_at", { withTimezone: true }),
    ackedAt: timestamp("acked_at", { withTimezone: true }),
  },
  (t) => [index("delivery_notification_idx").on(t.notificationId)],
);
