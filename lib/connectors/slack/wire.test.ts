// End to end: slack-inbound handler -> messageHook -> evidence rows. Needs Postgres (DATABASE_URL) and FalkorDB; skips without them.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeClient, graphFor, query, type Graph } from "../../graph/client";
import { seed } from "../../ingest/seed";
import { handleInbound, type Deps, type InboundJob } from "./interactive";

vi.mock("server-only", () => ({}));

const url = process.env.DATABASE_URL;
const org = `test-wire-${randomUUID()}`;
const gname = `test_wire_${randomUUID().replaceAll("-", "")}`;
let g: Graph;
let up = false;

beforeAll(async () => {
  if (!url) return;
  try {
    g = await graphFor(gname);
    await query(g, "RETURN 1");
    await seed(gname);
    const { db } = await import("../../db");
    const { orgs } = await import("../../db/schema");
    await db().insert(orgs).values({ id: org, slug: org, graphName: gname });
    up = true;
  } catch (e) {
    console.warn(`SKIPPING slack wire tests: ${String(e)}`);
  }
}, 30_000);
afterAll(async () => {
  try {
    if (up) {
      const { db } = await import("../../db");
      const { orgs, evidence, events } = await import("../../db/schema");
      const { eq } = await import("drizzle-orm");
      await db().delete(evidence).where(eq(evidence.orgId, org));
      await db().delete(events).where(eq(events.orgId, org));
      await db().delete(orgs).where(eq(orgs.id, org)); // cascades change_channel
      await g.delete();
    }
  } finally { await closeClient(); }
});
const t = (title: string, fn: () => Promise<void>) => it(title, async (ctx) => { if (!up) ctx.skip(); await fn(); });

async function deliver(channel: string, text: string, ts: string, channelName = "general") {
  const { messageHook } = await import("./wire");
  const { changeForChannel } = await import("./store");
  const slack = vi.fn(async (method: string, p?: Record<string, unknown>) => {
    if (method === "chat.getPermalink") return { permalink: `https://acme.slack.com/archives/${p?.channel}/p${String(p?.message_ts).replace(".", "")}` };
    if (method === "conversations.info") return { channel: { name: channelName } };
    return { user: { profile: { email: "priya@ledgerly.test" } } };
  });
  const call = slack as unknown as Deps["slack"]["call"];
  const deps = { graph: async () => g, slack: { call }, changeForChannel: (c: string) => changeForChannel(org, c), onMessageEvent: messageHook({ graph: async () => g, slack: { call } }) } as unknown as Deps;
  const job: InboundJob = { kind: "events", accountId: "acct", orgId: org, teamId: "T1", data: { type: "message", channel, user: "U1", text, ts } };
  await handleInbound(job, deps);
}
const rows = async () => {
  const { db } = await import("../../db");
  const { evidence } = await import("../../db/schema");
  const { eq } = await import("drizzle-orm");
  return db().select().from(evidence).where(eq(evidence.orgId, org));
};

describe("slack message events -> evidence", () => {
  t("a message in a mapped channel stores evidence with a permalink, and a renamed channel keeps its mapping", async () => {
    const { setChangeChannel, changeForChannel, channelForChange } = await import("./store");
    await setChangeChannel({ orgId: org, changeId: "d-1", slackTeamId: "T1", channelId: "C-MAPPED", name: "chg-refund-window" });
    expect(await changeForChannel(org, "C-MAPPED")).toBe("d-1");
    expect(await channelForChange(org, "d-1")).toBe("C-MAPPED");
    await deliver("C-MAPPED", "any thoughts?", "1800000000.000100", "chg-refund-window");
    await deliver("C-MAPPED", "still talking about it", "1800000001.000100", "renamed-by-someone"); // renamed: id mapping holds
    const r = (await rows()).filter((x) => x.channelId === "C-MAPPED");
    expect(r.map((x) => x.changeId)).toEqual(["d-1", "d-1"]);
    expect(r.map((x) => x.permalink).sort()).toEqual([
      "https://acme.slack.com/archives/C-MAPPED/p1800000000000100", "https://acme.slack.com/archives/C-MAPPED/p1800000001000100",
    ]);
  });

  t("a message in an unmapped channel that mentions d-1 by id still stores evidence; unrelated chatter does not", async () => {
    await deliver("C-RANDOM", "did anyone read d-1?", "1800000002.000100");
    await deliver("C-RANDOM", "lunch?", "1800000003.000100");
    const r = (await rows()).filter((x) => x.channelId === "C-RANDOM");
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ changeId: "d-1", permalink: "https://acme.slack.com/archives/C-RANDOM/p1800000002000100" });
  });

  t("users.info email maps the author to the seeded Person (Priya) and her team", async () => {
    await deliver("C-RANDOM2", "question about d-1", "1800000004.000100");
    const [r] = (await rows()).filter((x) => x.channelId === "C-RANDOM2");
    expect(r).toMatchObject({ personId: "p-priya", teamId: "eng", authorSlackId: "U1" });
  });

  t("the seeded change title matches without the id", async () => {
    await deliver("C-RANDOM3", "heads up: we Sunset API v1 on Jan 31, plan accordingly", "1800000005.000100");
    const r = (await rows()).filter((x) => x.channelId === "C-RANDOM3");
    expect(r.map((x) => x.changeId)).toEqual(["d-1"]);
  });
});
