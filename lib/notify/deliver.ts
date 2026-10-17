// Plans -> stored notifications (the inbox copy) -> queued `deliver` jobs -> one batched message per channel.
// Every function takes its db, readers, adapter and clock, so tests run on an injected `now` with no sleeping.
import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { safeMessage } from "../log";
import type { RippleEvent } from "../events/types";
import type { enqueue as Enqueue } from "../queue";
import * as schema from "../db/schema";
import type { Message as Built } from "./message";
import { route } from "./route";
import type { GraphReader, NotificationPlan, PrefsReader } from "./types";

const { notifications, deliveries, DELIVERY_CHANNELS } = schema;
type Db = PostgresJsDatabase<typeof schema>;
type Channel = (typeof DELIVERY_CHANNELS)[number];

export const BATCH_SECONDS = 15 * 60; // keep equal to route()'s batch bucket

const external = (channels: string[]) => channels.filter((c): c is Channel => (DELIVERY_CHANNELS as readonly string[]).includes(c));

export const titleFor = (e: Pick<RippleEvent, "type" | "subject">) => {
  const t = e.type.replaceAll(/[._]/g, " ");
  return `${t[0].toUpperCase()}${t.slice(1)}: ${e.subject.id}`;
};

/** Store one notification per plan (a replayed event is a no-op) and queue deliveries for the newly stored ones. */
export async function storeAndQueue(
  d: Db, event: RippleEvent, eventId: string | undefined, plans: NotificationPlan[],
  enqueue: typeof Enqueue,
): Promise<{ stored: number }> {
  let stored = 0;
  for (const p of plans) {
    const [row] = await d.insert(notifications).values({
      orgId: event.orgId, personId: p.personId, eventId, kind: event.type, title: titleFor(event),
      body: { reason: p.reason, subject: event.subject }, urgency: p.urgency, channels: p.channels,
      batchKey: p.batchKey, dedupeKey: p.dedupeKey,
    }).onConflictDoNothing({ target: notifications.dedupeKey }).returning({ id: notifications.id });
    if (!row) continue;
    stored++;
    if (!external(p.channels).length) continue;
    // High goes now. Normal/low waits for the end of its batch bucket (never before sendAt, so quiet hours hold),
    // so everything for this person in the window collapses into the one queued job for this batchKey.
    const at = p.urgency === "high" ? undefined : new Date((Math.floor(p.sendAt / BATCH_SECONDS) + 1) * BATCH_SECONDS * 1000);
    await enqueue("deliver", { orgId: event.orgId, batchKey: p.batchKey }, { singletonKey: p.batchKey, ...(at && { startAfter: at }) });
  }
  return { stored };
}

export async function routeAndStore(
  d: Db, event: RippleEvent, eventId: string | undefined,
  deps: { graph: GraphReader; prefs: PrefsReader; now: number; enqueue: typeof Enqueue },
) {
  return storeAndQueue(d, event, eventId, route(event, deps.graph, deps.prefs, deps.now), deps.enqueue);
}

// ---- delivery ----
export type Person = { id: string; email: string | null };
/** `sections`: one built message per notification (title, why, quotes, buttons); `lines` stays as the plain-text fallback. */
export type Message = { subject: string; lines: string[]; sections?: Built[] };
export type SendResult = { status: "sent" | "failed"; providerId?: string; error?: string };
export interface Adapter {
  send(channel: Channel, person: Person, message: Message): Promise<SendResult>;
}

const esc = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** Resend through the existing notify.ts send path. No key, no from-address or no recipient is a failure, not a send. */
export const emailAdapter: Adapter = {
  async send(_channel, person, m) {
    const [{ sendEmail }, { env }] = await Promise.all([import("../notify"), import("../env")]);
    let html = `<ul>${m.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`;
    if (m.sections?.length) {
      const [{ createElement }, { NotificationEmail }, { renderHtml }] = await Promise.all([
        import("react"), import("@/components/email/NotificationEmail"), import("../notify"),
      ]);
      const render = await renderHtml();
      html = m.sections.map((message) => render(createElement(NotificationEmail, { message }))).join("");
    }
    const r = await sendEmail(env(), person.email, m.subject, html);
    if (r.status === "sent") return { status: "sent", providerId: r.id };
    return { status: "failed", error: r.error ?? (person.email ? "email not configured (RESEND_API_KEY, RESEND_FROM)" : "no email address for person") };
  },
};

/** Dev adapter: prints the message. Stands in for Slack until the Slack connector lands. */
export const logAdapter: Adapter = {
  async send(channel, person, m) {
    console.log(`[deliver:${channel}] to ${person.id}: ${m.subject}\n  ${m.lines.join("\n  ")}`);
    for (const s of m.sections ?? []) console.log(`[deliver:${channel}] message ${JSON.stringify(s)}`);
    return { status: "sent", providerId: "log" };
  },
};

export const defaultAdapter: Adapter = {
  send: (channel, person, m) => (channel === "email" ? emailAdapter : logAdapter).send(channel, person, m),
};

/**
 * Send everything pending for a batch key as one message per person per channel and record what happened.
 * A notification already holding a delivery row for a channel is skipped, so a re-run never double-sends.
 * ponytail: a failed send is recorded, not retried; add a retry/backoff job when a real provider flakes.
 */
export async function deliverBatch(
  d: Db, job: { orgId: string; batchKey: string },
  deps: {
    adapter: Adapter; person: (id: string) => Person; now: () => number;
    /** Builds one notification's section for its delivery id (ack tokens carry it). A failure drops that section, never the send. */
    build?: (n: (typeof notifications)["$inferSelect"], deliveryId: string) => Promise<Built>;
  },
) {
  const rows = await d.select().from(notifications)
    .where(and(eq(notifications.orgId, job.orgId), eq(notifications.batchKey, job.batchKey))).orderBy(asc(notifications.createdAt));
  if (!rows.length) return [];
  const done = await d.select().from(deliveries).where(inArray(deliveries.notificationId, rows.map((r) => r.id)));
  const sent = new Set(done.map((x) => `${x.notificationId}:${x.channel}`));
  const results: { channel: Channel; personId: string; notificationIds: string[]; result: SendResult }[] = [];

  for (const channel of DELIVERY_CHANNELS) {
    const byPerson = new Map<string, typeof rows>();
    for (const r of rows) {
      if (!external(r.channels).includes(channel) || sent.has(`${r.id}:${channel}`)) continue;
      byPerson.set(r.personId, [...(byPerson.get(r.personId) ?? []), r]);
    }
    for (const [personId, items] of byPerson) {
      // ids are made here so each message can carry its own delivery id before the row's status moves on
      const queued = await d.insert(deliveries).values(items.map((n) => ({ id: randomUUID(), notificationId: n.id, channel, status: "queued" as const })))
        .returning({ id: deliveries.id, notificationId: deliveries.notificationId });
      const idOf = new Map(queued.map((q) => [q.notificationId, q.id]));
      const sections = deps.build
        ? (await Promise.all(items.map((n) => deps.build!(n, idOf.get(n.id)!).catch((e) => (console.warn("[deliver] build failed:", safeMessage(e)), null))))).filter((x): x is Built => !!x)
        : [];
      const message: Message = {
        subject: items.length === 1 ? items[0].title : `${items.length} updates from Ripple`,
        lines: items.map((n) => `${n.title} (${n.body.reason})`),
        ...(sections.length && { sections }),
      };
      let result: SendResult;
      try {
        result = await deps.adapter.send(channel, deps.person(personId), message);
      } catch (e) {
        result = { status: "failed", error: safeMessage(e) };
      }
      await d.update(deliveries).set({
        status: result.status, providerId: result.providerId ?? null, error: result.error ?? null,
        ...(result.status === "sent" && { sentAt: new Date(deps.now() * 1000) }),
      }).where(inArray(deliveries.id, queued.map((q) => q.id)));
      results.push({ channel, personId, notificationIds: items.map((n) => n.id), result });
    }
  }
  return results;
}
