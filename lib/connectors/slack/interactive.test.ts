import { randomUUID } from "node:crypto";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { encodeAckToken } from "../../ack-token";
import { runInteractive } from "../../agent/runtime";
import { closeClient, graphFor, query, type Graph } from "../../graph/client";
import { seed } from "../../ingest/seed";
import { handleInbound, type Deps, type InboundJob } from "./interactive";

vi.mock("server-only", () => ({}));

const name = `test_slack_${randomUUID().replaceAll("-", "")}`;
const NOW = Math.floor(Date.parse("2026-10-17T09:00:00Z") / 1000);
const FAR = 4_102_444_800;
let g: Graph;
let up = false;

beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", ""); // ack, audit and the queue are no-ops without Postgres
  try {
    g = await graphFor(name);
    await query(g, "RETURN 1");
    up = true;
    await seed(name);
    await query(g, "MATCH (c:Contract) SET c.name = c.name + ' SENTINEL_CONTRACT'");
  } catch (e) {
    console.warn(`SKIPPING slack interactive tests: FalkorDB unreachable (${String(e)})`);
  }
}, 30_000);
afterAll(async () => {
  try { if (up) await g.delete(); } finally { await closeClient(); }
});
const t = (title: string, fn: () => Promise<void>) => it(title, async (ctx) => { if (!up) ctx.skip(); await fn(); });

const usage = {
  inputTokens: { total: 3, noCache: 3, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};
const step = (chunks: unknown[]) => ({ stream: simulateReadableStream({ chunks: chunks as never[] }) });
const finish = (unified: string) => ({ type: "finish", finishReason: { unified, raw: undefined }, usage });

function setup(over: Partial<Deps> = {}) {
  const responses: { url: string; body: Record<string, unknown> }[] = [];
  const ingested: Parameters<Deps["ingest"]>[0][] = [];
  const deps: Deps = {
    graph: async () => g,
    slack: { call: vi.fn(async (method: string) => (method === "conversations.info" ? { channel: { name: "chg-d-1" } } : { permalink: "https://x.slack.com/archives/C1/p1" })) as Deps["slack"]["call"] },
    respond: async (url, body) => { responses.push({ url, body }); },
    asker: async () => ({ personId: "p-clicker", viewer: { teamIds: ["eng"], role: "member" } }),
    ingest: async (i) => { ingested.push(i); return { proposals: 3, duplicate: false }; },
    ask: () => (async function* () { /* none */ })(),
    changeForChannel: async () => null,
    onMessageEvent: vi.fn(async () => {}),
    ...over,
  };
  return { deps, responses, ingested };
}
const job = (kind: InboundJob["kind"], data: Record<string, unknown>): InboundJob => ({ kind, accountId: "acct", orgId: "org-1", teamId: "T1", data });
const edge = () => query<{ by: string; o: string | null; kind: string }>(g, "MATCH (:Team {id: 'legal'})-[a:ACKED]->(:Decision {id: 'd-1'}) RETURN a.by AS by, a.onBehalfOf AS o, a.kind AS kind");
const press = (action_id: string, value: string) => job("interactive", {
  type: "block_actions", user: { id: "U1" }, response_url: "https://hooks.slack.test/r", actions: [{ action_id, value }],
  message: { blocks: [{ type: "header", text: { type: "plain_text", text: "t" } }, { type: "actions", elements: [] }] },
});

describe("block actions", () => {
  t("ack records by = the token's person, onBehalfOf = the mapped Slack user; the message is updated in place", async () => {
    const { deps, responses } = setup();
    const token = encodeAckToken({ teamId: "legal", decisionId: "d-1", exp: FAR, o: "org-1", p: "p-real" });
    await handleInbound(press("ripple:ack:0", token), deps);
    expect(await edge()).toEqual([{ by: "p-real", o: "p-clicker", kind: "seen" }]);
    expect(responses).toHaveLength(1);
    expect(responses[0].body).toMatchObject({ replace_original: true, text: expect.stringContaining("Acknowledged by <@U1>") });
    expect(JSON.stringify(responses[0].body.blocks)).not.toContain('"actions"'); // buttons gone
  });

  t("the clicker being the recipient leaves onBehalfOf empty; concern maps to kind concern", async () => {
    const { deps } = setup({ asker: async () => ({ personId: "p-real", viewer: { teamIds: ["legal"] } }) });
    const token = encodeAckToken({ teamId: "legal", decisionId: "d-1", exp: FAR, o: "org-1", p: "p-real" });
    await handleInbound(press("ripple:concern:1", token), deps);
    expect(await edge()).toEqual([{ by: "p-real", o: null, kind: "concern" }]);
  });

  t("a tampered, expired or other-org token records nothing and says so ephemerally", async () => {
    const { deps, responses } = setup();
    const before = await edge();
    const good = encodeAckToken({ teamId: "legal", decisionId: "d-1", exp: FAR, o: "org-1", p: "p-x" });
    await handleInbound(press("ripple:ack:0", good + "x"), deps);
    await handleInbound(press("ripple:ack:0", encodeAckToken({ teamId: "legal", decisionId: "d-1", exp: 1, o: "org-1" })), deps);
    await handleInbound(press("ripple:ack:0", encodeAckToken({ teamId: "legal", decisionId: "d-1", exp: FAR, o: "org-2" })), deps);
    expect(await edge()).toEqual(before);
    expect(responses.map((r) => r.body.response_type)).toEqual(["ephemeral", "ephemeral", "ephemeral"]);
  });
});

describe("Save to Ripple", () => {
  const action = (channel: string) => job("interactive", {
    type: "message_action", callback_id: "save_to_ripple", user: { id: "U1" }, channel: { id: channel }, response_url: "https://hooks.slack.test/r",
    message: { text: "We decided to sunset api-v1 on Nov 1", ts: "1.1" },
  });

  t("ingests text + permalink, linked to the #chg- channel's change, and replies ephemerally", async () => {
    const { deps, responses, ingested } = setup();
    await handleInbound(action("C1"), deps);
    expect(ingested).toEqual([{ source: "message", title: "Slack message on d-1", text: "Change d-1. We decided to sunset api-v1 on Nov 1", ref: "https://x.slack.com/archives/C1/p1" }]);
    expect(responses[0].body).toEqual({ response_type: "ephemeral", text: "Saved — 3 edges proposed" });
  });

  t("a channel that is not a change room still saves, unlinked", async () => {
    const { deps, ingested } = setup({ slack: { call: (async (m: string) => (m === "conversations.info" ? { channel: { name: "random" } } : { permalink: "p" })) as Deps["slack"]["call"] } });
    await handleInbound(action("C2"), deps);
    expect(ingested[0]).toMatchObject({ title: "Slack message", text: "We decided to sunset api-v1 on Nov 1" });
  });
});

describe("/ripple", () => {
  const cmd = (text: string) => job("command", { command: "/ripple", text, user_id: "U1", channel_id: "C1", trigger_id: "tr1", response_url: "https://hooks.slack.test/r" });
  const model = () => new MockLanguageModelV4({
    doStream: [
      step([{ type: "tool-call", toolCallId: "c1", toolName: "ripple", input: JSON.stringify({ decisionId: "d-1" }) }, finish("tool-calls")]),
      step([{ type: "text-start", id: "t" }, { type: "text-delta", id: "t", delta: "Legal is affected [[art-rfc14]]." }, { type: "text-end", id: "t" }, finish("stop")]),
    ],
  });
  const run = async (teamIds: string[]) => {
    const m = model();
    const { deps, responses } = setup({
      asker: async () => ({ viewer: { teamIds, role: "member" } }),
      ask: (question, graph, viewer) => runInteractive({ model: m, question, g: graph, now: NOW, viewer }),
    });
    await handleInbound(cmd("who is affected by d-1?"), deps);
    return { responses, toolOut: JSON.stringify(m.doStreamCalls[1].prompt) };
  };

  t("answers through response_url with a Sources block; restricted text is redacted for a non-owner but not for the owner", async () => {
    const eng = await run(["eng"]);
    expect(eng.responses).toHaveLength(1);
    const body = eng.responses[0].body;
    expect(body.text).toContain("Legal is affected");
    expect(JSON.stringify(body.blocks)).toContain("Sources");
    expect(JSON.stringify(body.blocks)).toContain("art-rfc14");
    expect(eng.toolOut).not.toContain("SENTINEL_CONTRACT");
    expect(eng.toolOut).toContain('"restricted":[{'); // the sales-owned quote was redacted for eng
    expect((await run(["sales", "legal"])).toolOut).not.toContain('"restricted":[{');
  });

  t("an empty command shows usage; decision outside a change room refuses", async () => {
    const a = setup();
    await handleInbound(cmd(""), a.deps);
    expect(a.responses[0].body.text).toContain("Usage");
    const b = setup({ slack: { call: (async () => ({ channel: { name: "general" } })) as Deps["slack"]["call"] } });
    await handleInbound(cmd("decision ship it"), b.deps);
    expect(b.ingested).toHaveLength(0);
    expect(b.responses[0].body.text).toContain("#chg-");
  });

  t("/ripple decision <text> records a note on the channel's change", async () => {
    const { deps, responses, ingested } = setup();
    await handleInbound(cmd("decision keep v1 until Dec"), deps);
    expect(ingested[0]).toMatchObject({ source: "doc", title: "Decision note on d-1", ref: "slack:decision:tr1" });
    expect(ingested[0].text).toContain("keep v1 until Dec");
    expect(responses[0].body).toMatchObject({ response_type: "in_channel", text: expect.stringContaining("d-1") });
  });
});

describe("events", () => {
  it("message events go to the onMessageEvent hook; other events are ignored", async () => {
    const { deps } = setup();
    await handleInbound(job("events", { type: "message", text: "hi", channel: "C1" }), deps);
    await handleInbound(job("events", { type: "reaction_added" }), deps);
    expect(deps.onMessageEvent).toHaveBeenCalledTimes(1);
    expect(deps.onMessageEvent).toHaveBeenCalledWith({ orgId: "org-1", accountId: "acct", teamId: "T1", event: { type: "message", text: "hi", channel: "C1" } });
  });
});
