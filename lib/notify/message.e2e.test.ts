// End to end: change.confirmed -> route-event handler -> deliver handler (both in-process) -> logged message -> ack link.
// Real Postgres + FalkorDB (skips without them; CI has both). Only Date is faked; nothing sleeps.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeClient, graphFor, query, type Graph } from "../graph/client";
import { seed } from "../ingest/seed";
import { decodeAckToken } from "../ack-token";
import { RippleEvent } from "../events/types";
import type { Message } from "./message";

vi.mock("server-only", () => ({}));
vi.mock("../queue", () => ({ enqueue: vi.fn(async () => "job") })); // no pg-boss: the test calls the handlers itself

const NOW = Date.parse("2026-10-17T09:00:00Z");
const name = `test_m_${randomUUID().replaceAll("-", "")}`;
const org = `test-e2e-${randomUUID()}`;
let g: Graph;
let up = false;

describe.skipIf(!process.env.DATABASE_URL)("notification message end to end", () => {
  beforeAll(async () => {
    try {
      g = await graphFor(name);
      await query(g, "RETURN 1");
      await seed(name);
      up = true;
    } catch (e) {
      console.warn(`SKIPPING message e2e: FalkorDB unreachable (${String(e)})`);
      return;
    }
    await query(g, "MATCH ()-[r:GUARANTEES|PROMISED|HAS_CLAUSE]->() SET r.quote = 'SENTINEL_SRC ' + coalesce(r.quote, '')");
    await query(g, "MATCH ()-[r:GUARANTEES|PROMISED|HAS_CLAUSE]->() WITH collect(DISTINCT r.src) AS ids MATCH (a:Artifact) WHERE a.id IN ids SET a.title = a.title + ' SENTINEL_SRC'");
    const { db } = await import("../db");
    const { orgs } = await import("../db/schema");
    await db().insert(orgs).values({ id: org, slug: org, graphName: name });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  }, 60_000);

  afterAll(async () => {
    vi.useRealTimers();
    if (!up) return;
    const { db } = await import("../db");
    const { orgs, notifications, events } = await import("../db/schema");
    const { eq } = await import("drizzle-orm");
    await db().delete(notifications).where(eq(notifications.orgId, org));
    await db().delete(events).where(eq(events.orgId, org));
    await db().delete(orgs).where(eq(orgs.id, org));
    await g.delete();
    await closeClient();
  });

  it("emits, routes, delivers: title, redacted quotes, four buttons, and the ack link marks the delivery acked", async (ctx) => {
    if (!up) ctx.skip();
    const { db } = await import("../db");
    const { emit } = await import("../events/emit");
    const { notifications, deliveries } = await import("../db/schema");
    const { eq } = await import("drizzle-orm");
    const d = db();

    const event = RippleEvent.parse({ type: "change.confirmed", orgId: org, subject: { kind: "decision", id: "d-1" }, payload: { changeId: "d-1" }, dedupeKey: `cc:${org}` });
    const { id: eventId } = await emit(d, event);
    expect(eventId).toBeTruthy();

    const routeEvent = (await import("../../worker/handlers/route-event")).default;
    await routeEvent([{ data: { eventId, type: event.type, orgId: org } }] as never);
    const stored = await d.select().from(notifications).where(eq(notifications.orgId, org));
    expect(stored.length).toBeGreaterThan(0);

    const lines: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => void lines.push(a.join(" ")));
    const deliver = (await import("../../worker/handlers/deliver")).default;
    for (const batchKey of new Set(stored.filter((n) => n.channels.includes("slack_dm")).map((n) => n.batchKey))) {
      await deliver([{ data: { orgId: org, batchKey } }] as never);
    }
    spy.mockRestore();

    // "[deliver:slack_dm] to <person>: ..." followed by "[deliver:slack_dm] message {json}"
    const sent = lines.flatMap((l) => l.split("\n")).reduce<{ to: string; m: Message }[]>((acc, l) => {
      const to = /^\[deliver:slack_dm\] to (\S+):/.exec(l)?.[1];
      const json = /^\[deliver:slack_dm\] message (.*)$/.exec(l)?.[1];
      return to ? [...acc, { to, m: undefined as never }] : json ? [...acc.slice(0, -1), { to: acc.at(-1)!.to, m: JSON.parse(json) as Message }] : acc;
    }, []).filter((x) => x.m);
    expect(sent.length).toBeGreaterThan(0);
    for (const { m } of sent) {
      expect(m.title).toBe("Change confirmed: d-1");
      expect(m.actions.map((a) => a.kind)).toEqual(["ack", "concern", "not_relevant", "open"]);
      expect(m.actions[3].url).toMatch(/\/r\/[0-9a-f-]{36}$/);
    }
    // someone who does not own the quotes sees the placeholder and none of the restricted text
    const redacted = sent.filter(({ m }) => m.quotes.some((q) => q.text === "[restricted]"));
    expect(redacted.length).toBeGreaterThan(0);
    for (const { m } of redacted) expect(JSON.stringify(m)).not.toContain("SENTINEL_SRC");

    // following the ack link (the page posts the token to /api/ack) marks that delivery acked
    const { m, to } = sent[0];
    const url = new URL(m.actions[0].url, "http://t");
    const token = url.pathname.split("/ack/")[1];
    const t = decodeAckToken(token);
    expect(t.state === "ok" && t.payload.d).toBeTruthy();
    const deliveryId = t.state === "ok" ? t.payload.d! : "";
    expect((await d.select().from(deliveries).where(eq(deliveries.id, deliveryId)))[0].status).toBe("sent");

    process.env.RIPPLE_GRAPH = name;
    try {
      const { POST } = await import("../../app/api/ack/route");
      const res = await POST(new Request("http://t/api/ack", { method: "POST", body: JSON.stringify({ token, kind: url.searchParams.get("r") }) }));
      expect(res.status, await res.clone().text()).toBe(200);
    } finally {
      delete process.env.RIPPLE_GRAPH;
    }
    const row = (await d.select().from(deliveries).where(eq(deliveries.id, deliveryId)))[0];
    expect(row.status).toBe("acked");
    expect(row.ackedAt).toBeTruthy();
    expect(to).toBeTruthy();
  }, 60_000);
});
