// Comms Planner and Courier end to end on a seeded temp graph with a mocked Slack. Needs FalkorDB (skips without); no Postgres.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeClient, graphFor, query, roQuery, type Graph } from "../graph/client";
import { detectConflicts } from "../graph/queries";
import { seed } from "../ingest/seed";
import { slackClient } from "../connectors/slack/client";
import { TOOLS } from "../agent/tools";
import { buildPlan } from "./plan";
import { applyCampaignPlan, courierNext, createChangeChannel, postToChannel } from "./run";

vi.mock("server-only", () => ({}));
vi.stubEnv("DATABASE_URL", ""); // Postgres-free by design: with it set (CI), campaignStatus would read the ledger from a database this test does not own

const name = `test_camp_${randomUUID().replaceAll("-", "")}`;
const NOW = Math.floor(Date.parse("2026-10-17T09:00:00Z") / 1000);
const CHANGE = Math.floor(Date.parse("2027-01-31T09:00:00Z") / 1000);
const org = { id: "org-camp" };
let g: Graph;
let up = false;

beforeAll(async () => {
  try {
    g = await graphFor(name);
    await query(g, "RETURN 1");
    await seed(name);
    await detectConflicts(g, NOW);
    up = true;
  } catch (e) {
    console.warn(`SKIPPING campaign tests: FalkorDB unreachable (${String(e)})`);
  }
}, 30_000);
afterAll(async () => {
  if (up) await g.delete();
  await closeClient();
});
const t = (title: string, fn: () => Promise<void>) => it(title, async (ctx) => { if (!up) ctx.skip(); await fn(); });

/** A Slack that records every API call. */
function mockSlack() {
  const calls: { method: string; params: Record<string, string> }[] = [];
  let ts = 0;
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const method = String(url).split("/api/")[1];
    const params = Object.fromEntries(new URLSearchParams(init?.body as URLSearchParams));
    calls.push({ method, params });
    if (method === "conversations.create") return Response.json({ ok: true, channel: { id: "C-CHG", name: params.name } });
    if (method === "users.lookupByEmail") return Response.json({ ok: true, user: { id: `U-${params.email.split("@")[0]}` } });
    if (method === "chat.postMessage") return Response.json({ ok: true, ts: `100.${++ts}`, channel: params.channel });
    return Response.json({ ok: true });
  }) as unknown as typeof fetch;
  return { calls, slack: slackClient("xoxb-test", { fetch: fetchMock, sleep: async () => {} }) };
}
const emitBrief = vi.fn(async () => ({}));
const kickCourier = vi.fn(async () => ({}));
const approve = async (plan: unknown) => applyCampaignPlan({ g, org, now: NOW, approver: "u-owner", emitBrief, kickCourier }, plan);

describe("Comms Planner plan", () => {
  t("d-1: Legal, Security and DevRel each get an owner and a due date before the change, and the conflict makes a shared channel", async () => {
    const plan = (await buildPlan(g, "d-1", NOW))!;
    const by = new Map(plan.teams.map((x) => [x.teamId, x]));
    for (const id of ["legal", "security", "devrel"]) {
      const x = by.get(id)!;
      expect(x.ownerId, id).toBeTruthy();
      expect(x.dueAt, id).toBeLessThan(CHANGE);
      expect(x.dueAt, id).toBeGreaterThan(NOW);
      expect(x.briefNeeded, id).toBe(true);
    }
    expect(by.get("legal")!.dueAt).toBeLessThan(by.get("devrel")!.dueAt); // Legal needs the longest lead time
    expect(by.get("sales")!.briefNeeded).toBe(false); // already acknowledged
    expect(plan.channel).toEqual({ name: "chg-sunset-api-v1-on-jan-31", reason: "both" });
  });
});

describe("Courier (Postgres-free, Slack mocked)", () => {
  t("nothing is created or sent before the campaign is approved", async () => {
    const { calls, slack } = mockSlack();
    const proposed: unknown[] = [];
    const propose = async (kind: string, payload: unknown) => { proposed.push({ kind, payload }); return { id: "a1", status: "pending", created: true }; };
    // the Comms Planner's tool only proposes
    await TOOLS.propose_campaign_plan.run({ g, now: NOW, demo: false, propose: propose as never }, { decisionId: "d-1" });
    expect(proposed).toHaveLength(1);
    expect(emitBrief).not.toHaveBeenCalled();
    expect(await roQuery(g, "MATCH (c:Campaign) RETURN c.id AS id")).toEqual([]);
    // the Courier has nothing to do, and the executors refuse
    expect(await courierNext(g, org, "d-1", NOW)).toEqual({ action: "none", reason: "not_approved" });
    const out = await TOOLS.propose_slack_channel_create.run({ g, now: NOW, demo: false, propose: propose as never, org }, { decisionId: "d-1" });
    expect(out.rows[0]).toMatchObject({ proposed: false, reason: "not_approved" });
    await expect(createChangeChannel({ g, org, now: NOW, slack, saveChannel: async () => {} }, { decisionId: "d-1", campaignId: "camp-d-1" })).rejects.toThrow("not approved");
    expect(calls).toEqual([]);
    expect(proposed).toHaveLength(1);
  });

  t("approval creates the campaign and briefs; the channel, owners, pinned tracker, updates and archive follow", async () => {
    const plan = (await buildPlan(g, "d-1", NOW))!;
    await approve(plan);
    expect(emitBrief.mock.calls.map((c) => (c as unknown as [{ teamId: string }])[0].teamId).sort()).toEqual(["devrel", "legal", "security"]);
    expect(kickCourier).toHaveBeenCalledWith("d-1");
    const [task] = await roQuery<{ dueAt: number }>(g, "MATCH (k:Task {id: 'task-d-1-legal'}) RETURN k.dueAt AS dueAt");
    expect(task.dueAt).toBe(plan.teams.find((x) => x.teamId === "legal")!.dueAt);

    const next = await courierNext(g, org, "d-1", NOW);
    expect(next).toEqual({ action: "slack_channel_create", payload: { decisionId: "d-1", campaignId: "camp-d-1" } });

    const { calls, slack } = mockSlack();
    const saved = vi.fn(async () => {});
    const made = await createChangeChannel({ g, org, now: NOW, slack, saveChannel: saved }, next.action === "slack_channel_create" ? next.payload : null);
    expect(made).toMatchObject({ channelId: "C-CHG", name: "chg-sunset-api-v1-on-jan-31", threads: 5 });
    const m = calls.map((c) => c.method);
    expect(m.indexOf("conversations.create")).toBeLessThan(m.indexOf("conversations.invite"));
    const inv = calls.find((c) => c.method === "conversations.invite")!;
    for (const u of ["U-mei", "U-tara", "U-maya"]) expect(inv.params.users.split(",")).toContain(u); // team owners
    const posts = calls.filter((c) => c.method === "chat.postMessage");
    expect(posts).toHaveLength(6); // tracker + one thread root per team
    expect(posts[0].params.text).toContain("Tracker");
    expect(calls.find((c) => c.method === "pins.add")!.params).toMatchObject({ channel: "C-CHG", timestamp: "100.1" });
    expect(saved).toHaveBeenCalledWith({ changeId: "d-1", channelId: "C-CHG", name: "chg-sunset-api-v1-on-jan-31" });

    // nothing changed yet: no update proposed
    expect(await courierNext(g, org, "d-1", NOW)).toEqual({ action: "none", reason: "unchanged" });

    // Legal acknowledges -> the tracker is refreshed with chat.update on the pinned message
    await query(g, "MATCH (t:Team {id: 'legal'}), (d:Decision {id: 'd-1'}) MERGE (t)-[r:ACKED]->(d) SET r.kind = 'ack', r.at = $now, r.valid_from = $now, r.valid_to = null", { now: NOW });
    const upd = await courierNext(g, org, "d-1", NOW);
    expect(upd).toMatchObject({ action: "slack_post", payload: { op: "tracker" } });
    calls.length = 0;
    await postToChannel({ g, org, now: NOW, slack }, upd.action === "slack_post" ? upd.payload : null);
    const cu = calls.find((c) => c.method === "chat.update")!;
    expect(cu.params).toMatchObject({ channel: "C-CHG", ts: "100.1" });
    expect(cu.params.text).toMatch(/Legal\*?: .*acked yes/);
    expect(await courierNext(g, org, "d-1", NOW)).toEqual({ action: "none", reason: "unchanged" });

    // everything done -> close: final tracker, then archive
    await query(g, "MATCH (t:Team), (d:Decision {id: 'd-1'}) WHERE t.id IN ['security', 'devrel'] MERGE (t)-[r:ACKED]->(d) SET r.kind = 'ack', r.at = $now, r.valid_from = $now, r.valid_to = null", { now: NOW });
    await query(g, "MATCH (k:Task) WHERE k.id STARTS WITH 'task-d-1-' SET k.status = 'done'");
    const done = await courierNext(g, org, "d-1", NOW);
    expect(done).toMatchObject({ action: "slack_post", payload: { op: "archive" } });
    calls.length = 0;
    await postToChannel({ g, org, now: NOW, slack }, done.action === "slack_post" ? done.payload : null);
    expect(calls.map((c) => c.method)).toEqual(["chat.update", "chat.postMessage", "conversations.archive"]);
    expect(await courierNext(g, org, "d-1", NOW)).toEqual({ action: "none", reason: "closed" });
  });
});
