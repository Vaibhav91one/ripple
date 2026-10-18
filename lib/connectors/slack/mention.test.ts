import { beforeEach, describe, expect, it, vi } from "vitest";
import { ingest } from "./ingest";
import { handleInbound, type Deps, type InboundJob } from "./interactive";
import { neutralizeSlack, replyGate, resetReplyGate } from "./mention";
import { slackManifest } from "./manifest";
import { signSlack } from "./verify";

vi.mock("server-only", () => ({}));
const job = (data: Record<string, unknown>): InboundJob => ({ kind: "events", accountId: "a1", orgId: "o1", teamId: "T1", data });
const MENTION = { type: "app_mention", user: "U1", channel: "C1", ts: "100.1", text: "<@UBOT> who is hit?" };

function setup(answer: string | (() => never) = "The **legal** team is hit.") {
  const calls: { method: string; params: Record<string, unknown> }[] = [];
  const asker = vi.fn(async () => ({ viewer: { teamIds: [] as string[] } }));
  let question = "";
  const d = {
    graph: async () => ({}) as never,
    slack: { call: async (method: string, params: Record<string, unknown> = {}) => { calls.push({ method, params }); return {} as never; } },
    botUserId: async () => "UBOT", asker, onMessageEvent: vi.fn(),
    ask: async function* (q: string) {
      question = q;
      if (typeof answer === "function") answer();
      yield { type: "text_delta", text: answer } as const;
      yield { type: "citation", sources: [{ artifactId: "art-1", quote: "Legal owns it" }] } as never;
    },
  } as unknown as Deps;
  return { d, calls, asker, posts: () => calls.filter((c) => c.method === "chat.postMessage").map((c) => c.params), q: () => question };
}

beforeEach(() => { resetReplyGate(); delete process.env.SLACK_REPLIES_PER_HOUR; });

describe("slack mentions and DMs", () => {
  it("a mention gets a threaded reply with sources, as a no-team viewer when unmapped", async () => {
    const t = setup();
    await handleInbound(job(MENTION), t.d);
    expect(t.posts()).toHaveLength(1);
    expect(t.posts()[0]).toMatchObject({ channel: "C1", thread_ts: "100.1" });
    expect(String(t.posts()[0].text)).toContain("*legal*");
    expect(String(t.posts()[0].text)).toContain("art-1");
    expect(t.q()).toBe("who is hit?");
    expect(t.calls.find((c) => c.method === "assistant.threads.setStatus" && c.params.status === "")).toBeTruthy();
  });

  it("replies inside the existing thread", async () => {
    const t = setup();
    await handleInbound(job({ ...MENTION, thread_ts: "50.0" }), t.d);
    expect(t.posts()[0].thread_ts).toBe("50.0");
  });

  it("a DM gets a reply; a channel message does not and still feeds evidence", async () => {
    const t = setup();
    await handleInbound(job({ type: "message", channel_type: "im", user: "U1", channel: "D1", ts: "5.5", text: "hello" }), t.d);
    expect(t.posts()[0]).toMatchObject({ channel: "D1", thread_ts: "5.5" });
    expect(t.d.onMessageEvent).not.toHaveBeenCalled();
    await handleInbound(job({ type: "message", channel_type: "channel", user: "U1", channel: "C1", ts: "6.6", text: "hello" }), t.d);
    expect(t.posts()).toHaveLength(1);
    expect(t.d.onMessageEvent).toHaveBeenCalledTimes(1);
  });

  it("ignores our own bot, other bots, edits and users from another workspace", async () => {
    const t = setup();
    await handleInbound(job({ ...MENTION, user: "UBOT" }), t.d);
    await handleInbound(job({ ...MENTION, bot_id: "B9" }), t.d);
    await handleInbound(job({ ...MENTION, subtype: "message_changed" }), t.d);
    await handleInbound(job({ ...MENTION, user_team: "T-OTHER" }), t.d);
    expect(t.posts()).toHaveLength(0);
    expect(t.asker).not.toHaveBeenCalled();
  });

  it("rate limits per workspace, warns once, and recovers after the hour", async () => {
    process.env.SLACK_REPLIES_PER_HOUR = "2";
    const t = setup();
    for (let i = 0; i < 4; i++) await handleInbound(job({ ...MENTION, ts: `${i}.0` }), t.d);
    const texts = t.posts().map((p) => String(p.text));
    expect(texts.filter((x) => x.includes("hourly reply limit"))).toHaveLength(1);
    expect(texts).toHaveLength(3);
    expect(replyGate("T1", Date.now() + 3_700_000)).toBe("ok");
    expect(replyGate("T2")).toBe("ok");
  });

  it("answers politely when the agent throws (e.g. no model)", async () => {
    const t = setup(() => { throw new Error("boom sk-secret"); });
    await handleInbound(job(MENTION), t.d);
    expect(String(t.posts()[0].text)).toContain("could not answer");
    expect(String(t.posts()[0].text)).not.toContain("sk-secret");
  });

  it("says hello when our bot joins a channel, not when someone else does", async () => {
    const t = setup();
    await handleInbound(job({ type: "member_joined_channel", user: "UOTHER", channel: "C1" }), t.d);
    expect(t.posts()).toHaveLength(0);
    await handleInbound(job({ type: "member_joined_channel", user: "UBOT", channel: "C1" }), t.d);
    expect(t.posts()).toHaveLength(1);
  });
});

describe("neutralizeSlack", () => {
  it("defuses user, group, here/channel/everyone pings", () => {
    const out = neutralizeSlack("hi <@U123ABC> <@W9|bob> <!here> <!channel|channel> <!subteam^S1|@eng> @everyone @here");
    expect(out).not.toMatch(/<@|<!|@here|@channel|@everyone/);
    expect(out).toContain("@​U123ABC");
  });
  it("is applied to the posted reply", async () => {
    const t = setup("ping <@U999> <!channel> @here");
    await handleInbound(job(MENTION), t.d);
    expect(String(t.posts()[0].text)).not.toMatch(/<@U999>|<!channel>|@here/);
  });
});

describe("ingest for events", () => {
  const SECRET = "s3";
  beforeEach(() => { process.env.SLACK_SIGNING_SECRET = SECRET; });
  const req = (body: string, extra: Record<string, string> = {}) => new Request("https://ripple.test/api/slack/events", { method: "POST", body, headers: { ...signSlack(body, SECRET), ...extra } });
  const body = JSON.stringify({ type: "event_callback", team_id: "T1", event_id: "Ev9", event: MENTION });

  it("unknown workspace: acks 200 and enqueues nothing", async () => {
    const enq = vi.fn();
    const res = await ingest(req(body), "events", { hasDb: false, accounts: async () => [], enqueue: enq });
    expect(res.status).toBe(200);
    expect(enq).not.toHaveBeenCalled();
  });

  it("a Slack retry (same event_id) is not enqueued twice", async () => {
    const enq = vi.fn(async () => "j");
    let seen = false;
    const emit = vi.fn(async () => { const inserted = !seen; seen = true; return { inserted } as never; });
    const deps = { hasDb: true, accounts: async () => [{ id: "a1", orgId: "o1" }], enqueue: enq as never, emit: emit as never };
    vi.doMock("../../db", () => ({ db: () => ({}) }));
    expect((await ingest(req(body), "events", deps)).status).toBe(200);
    expect((await ingest(req(body, { "x-slack-retry-num": "1", "x-slack-retry-reason": "http_timeout" }), "events", deps)).status).toBe(200);
    expect(enq).toHaveBeenCalledTimes(1);
  });
});

describe("slackManifest", () => {
  it("swaps the hosted URL for this deployment and lists the new events and scopes", () => {
    const y = slackManifest("https://my.example.com/");
    expect(y).toContain("https://my.example.com/api/slack/events");
    expect(y).not.toContain("ripple.vaibhav.quest/api");
    for (const k of ["app_mention", "message.im", "member_joined_channel", "app_mentions:read", "im:history", "assistant:write", "agent_view:", "messages_tab_enabled: true"]) expect(y).toContain(k);
  });
});
