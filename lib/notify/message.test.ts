// buildMessage is pure (no DB, no graph); the delivery ledger part runs on a real Postgres (skips without DATABASE_URL; CI sets it).
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { decodeAckToken } from "../ack-token";
import { buildMessage, type MessageCtx } from "./message";

vi.mock("server-only", () => ({}));

const n = { title: "Sunset API v1", body: { reason: "team_owner", subject: { kind: "decision", id: "d-1" } } };
const quotes = [{ artifactId: "a-1", title: "MSA", quote: "v1 until 2027" }, { artifactId: "a-2", title: "Slack", quote: "ok" }];
const ctx = (o: Partial<MessageCtx> = {}): MessageCtx => ({
  orgId: "o1", personId: "p-mei", now: 1_800_000_000, baseUrl: "https://r.test", viewer: { teamIds: ["legal"] },
  index: { ids: new Map(), artifacts: new Map([["a-1", "legal"]]) }, quotes, ack: { teamId: "legal", decisionId: "d-1" }, ...o,
});

describe("buildMessage", () => {
  it("has the three ack actions and a tracked open link, tokens carry org, person, delivery and reply", () => {
    const dId = randomUUID();
    const m = buildMessage(n, ctx({ deliveryId: dId }));
    expect(m.actions.map((a) => a.kind)).toEqual(["ack", "concern", "not_relevant", "open"]);
    expect(m.actions[3].url).toBe(`https://r.test/r/${dId}`);
    expect(m.deepLink).toBe("https://r.test/items/decision/d-1");
    const tok = m.actions[1].url.split("/ack/")[1].split("?")[0];
    const t = decodeAckToken(tok, 1_800_000_001);
    expect(t.state === "ok" && t.payload).toMatchObject({ o: "o1", p: "p-mei", d: dId, r: "concern", teamId: "legal", decisionId: "d-1" });
  });
  it("without an ack target only opens, straight to the deep link when there is no delivery", () => {
    const m = buildMessage(n, ctx({ ack: undefined }));
    expect(m.actions).toEqual([{ kind: "open", url: m.deepLink }]);
  });
  it("a digest opens its agent run", () => {
    const m = buildMessage({ ...n, body: { ...n.body, subject: { kind: "digest", id: "run-1" } } }, ctx({ ack: undefined }));
    expect(m.deepLink).toBe("https://r.test/agents/runs/run-1");
  });
  it("shows an owner the quote and a non-owner the placeholder", () => {
    expect(buildMessage(n, ctx()).quotes.map((q) => q.text)).toEqual(["v1 until 2027", "ok"]);
    const out = buildMessage(n, ctx({ viewer: { teamIds: ["eng"] } }));
    expect(out.quotes.map((q) => q.text)).toEqual(["[restricted]", "ok"]);
    expect(JSON.stringify(out)).not.toMatch(/v1 until 2027|MSA/);
  });
});

describe.skipIf(!process.env.DATABASE_URL)("delivery ledger (Postgres)", () => {
  const org = `test-msg-${randomUUID()}`;
  afterAll(async () => {
    const { db } = await import("../db");
    const { notifications } = await import("../db/schema");
    const { eq } = await import("drizzle-orm");
    await db().delete(notifications).where(eq(notifications.orgId, org)); // cascades deliveries
  });

  async function delivery() {
    const { db } = await import("../db");
    const { notifications, deliveries } = await import("../db/schema");
    const [nt] = await db().insert(notifications).values({
      orgId: org, personId: "p-mei", kind: "decision.created", title: "t", body: n.body, urgency: "high", channels: ["email"], batchKey: randomUUID(), dedupeKey: randomUUID(),
    }).returning({ id: notifications.id });
    const [d] = await db().insert(deliveries).values({ notificationId: nt.id, channel: "email", status: "sent" }).returning({ id: deliveries.id });
    return d.id;
  }
  const status = async (id: string) => {
    const { db } = await import("../db");
    const { deliveries } = await import("../db/schema");
    const { eq } = await import("drizzle-orm");
    return (await db().select().from(deliveries).where(eq(deliveries.id, id)))[0];
  };

  it("the open link records clicked and redirects to the item", async () => {
    const id = await delivery();
    const { GET } = await import("../../app/r/[id]/route");
    const res = await GET(new Request(`http://t/r/${id}`), { params: Promise.resolve({ id }) } as never);
    expect(res.status).toBe(302);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/items/decision/d-1");
    const row = await status(id);
    expect(row.status).toBe("clicked");
    expect(row.clickedAt).toBeTruthy();
  });
  it("behind the proxy (req.url is 0.0.0.0) the redirect stays relative", async () => {
    const id = await delivery();
    const { GET } = await import("../../app/r/[id]/route");
    const res = await GET(new Request(`https://0.0.0.0:3000/r/${id}`), { params: Promise.resolve({ id }) } as never);
    expect(res.headers.get("location")).toBe("/items/decision/d-1");
  });
  it("an unknown delivery goes home", async () => {
    const id = randomUUID();
    const { GET } = await import("../../app/r/[id]/route");
    const res = await GET(new Request(`http://t/r/${id}`), { params: Promise.resolve({ id }) } as never);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/");
  });
  it("an ack button records acked, and a later click does not undo it", async () => {
    const id = await delivery();
    const { markDelivery } = await import("./track");
    expect(await markDelivery(id, "acked")).toBe(true);
    expect(await markDelivery(id, "clicked")).toBe(false);
    expect(await markDelivery(id, "acked")).toBe(false);
    const row = await status(id);
    expect(row.status).toBe("acked");
    expect(row.ackedAt).toBeTruthy();
  });
});
