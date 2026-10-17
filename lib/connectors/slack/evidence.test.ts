// Needs Postgres (evidence + event tables); the matcher tests run without it. CI sets DATABASE_URL.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { matchChanges, type EvidenceCtx, type KnownChange } from "./evidence";

vi.mock("server-only", () => ({}));
const url = process.env.DATABASE_URL;

const d1: KnownChange = { id: "d-1", title: "Refund window cut to 14 days", channelId: "C-CHG" };
const d12: KnownChange = { id: "d-12", title: "Pricing page" };

describe("matchChanges", () => {
  it("matches id as a word, /changes and /items links, title and the change's own channel", () => {
    const hit = (text: string, channel = "C-GEN") => matchChanges({ text, channel }, [d1, d12]).map((c) => c.id);
    expect(hit("did anyone read d-1?")).toEqual(["d-1"]);
    expect(hit("see https://ripple.test/changes/d-1")).toEqual(["d-1"]);
    expect(hit("https://ripple.test/items/d-12#x")).toEqual(["d-12"]);
    expect(hit("the refund window cut to 14 days hurts us")).toEqual(["d-1"]);
    expect(hit("anything at all", "C-CHG")).toEqual(["d-1"]);
  });
  it("does not match d-1 inside d-12 or unrelated text", () => {
    expect(matchChanges({ text: "ship d-12 today", channel: "C" }, [d1]).map((c) => c.id)).toEqual([]);
    expect(matchChanges({ text: "lunch?", channel: "C" }, [d1, d12])).toEqual([]);
  });
});

describe.skipIf(!url)("recordEvidenceFromMessage (Postgres)", () => {
  const org = `test-ev-${randomUUID()}`;
  afterAll(async () => {
    const { db } = await import("../../db");
    const { evidence, events } = await import("../../db/schema");
    const { eq } = await import("drizzle-orm");
    await db().delete(evidence).where(eq(evidence.orgId, org));
    await db().delete(events).where(eq(events.orgId, org));
  });

  const setup = async () => {
    const { db } = await import("../../db");
    const { recordEvidenceFromMessage } = await import("./evidence");
    const ctx: EvidenceCtx = {
      db: db(), orgId: org, changes: [d1],
      person: (u) => (u === "U-ANA" ? { personId: "p-ana", teamId: "t-sup" } : null),
      teamOfChannel: (c) => (c === "C-GEN" ? "t-gen" : null),
      permalink: async (c, ts) => `https://acme.slack.com/archives/${c}/p${ts.replace(".", "")}`,
    };
    return { ctx, record: recordEvidenceFromMessage, d: db() };
  };
  const msg = { type: "message", channel: "C-GEN", user: "U-ANA", text: "heads up on d-1, refunds change", ts: "1800000000.000100" };

  it("stores evidence with a permalink, maps the author, emits an event, and is idempotent", async () => {
    const { ctx, record, d } = await setup();
    expect(await record(ctx, msg)).toBe(1);
    expect(await record(ctx, msg)).toBe(0); // Slack retry
    const { evidence, events } = await import("../../db/schema");
    const { eq } = await import("drizzle-orm");
    const rows = await d.select().from(evidence).where(eq(evidence.orgId, org));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      changeId: "d-1", teamId: "t-sup", channelId: "C-GEN", personId: "p-ana", authorSlackId: "U-ANA",
      permalink: "https://acme.slack.com/archives/C-GEN/p1800000000000100",
    });
    const ev = await d.select().from(events).where(eq(events.orgId, org));
    expect(ev.filter((e) => e.type === "evidence.recorded")).toHaveLength(1);
  });

  it("falls back to the channel's team for an unmapped author, and ignores bots, edits and other text", async () => {
    const { ctx, record, d } = await setup();
    expect(await record(ctx, { ...msg, user: "U-NOBODY", ts: "1800000001.000100" })).toBe(1);
    expect(await record(ctx, { ...msg, bot_id: "B1", ts: "1800000002.000100" })).toBe(0);
    expect(await record(ctx, { ...msg, subtype: "message_changed", ts: "1800000003.000100" })).toBe(0);
    expect(await record(ctx, { ...msg, text: "lunch?", ts: "1800000004.000100" })).toBe(0);
    const { evidence } = await import("../../db/schema");
    const { and, eq } = await import("drizzle-orm");
    const [r] = await d.select().from(evidence).where(and(eq(evidence.orgId, org), eq(evidence.messageTs, "1800000001.000100")));
    expect(r).toMatchObject({ teamId: "t-gen", personId: null });
  });

  it("shows as discussed in the ledger and never flips ack state", async () => {
    const { ctx, record, d } = await setup();
    const { notifications, deliveries } = await import("../../db/schema");
    const { ledgerFor } = await import("../../notify/ledger");
    const mk = async () => (await d.insert(notifications).values({
      orgId: org, personId: "p-ana", kind: "brief.sent", title: "t", body: { reason: "brief_recipient", subject: { kind: "change", id: "d-1" } },
      urgency: "normal", channels: ["slack_dm"], batchKey: `b:${randomUUID()}`, dedupeKey: randomUUID(),
    }).returning({ id: notifications.id }))[0].id;
    await d.insert(deliveries).values({ notificationId: await mk(), channel: "slack_dm", status: "sent", sentAt: new Date() });
    const before = await ledgerFor(d, org, "d-1", () => "t-sup");
    expect(before[0].ackedAt).toBeNull();

    await record(ctx, { ...msg, ts: "1800000009.000100" });
    const after = await ledgerFor(d, org, "d-1", () => "t-sup");
    expect(after[0].ackedAt).toBeNull(); // discussed is not acknowledged
    expect(after[0].discussed.length).toBeGreaterThan(0);
    expect(after[0].discussed[0]).toMatchObject({ channelId: "C-GEN", byPersonId: "p-ana" });
    const { eq } = await import("drizzle-orm");
    await d.delete(notifications).where(eq(notifications.orgId, org));
  });
});
