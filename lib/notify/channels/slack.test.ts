import { describe, expect, it, vi } from "vitest";
import { slackClient } from "../../connectors/slack/client";
import { encodeAckToken } from "../../ack-token";
import { composeAdapter } from "../deliver";
import { route } from "../route";
import { RippleEvent } from "../../events/types";
import type { GraphReader } from "../types";
import { slackAdapter } from "./slack";

vi.mock("server-only", () => ({}));

const token = encodeAckToken({ teamId: "t1", decisionId: "d1", exp: 9e9, o: "org", p: "p1", d: "11111111-1111-1111-1111-111111111111", r: "seen" });
const section = {
  title: "Decision: d1", why: "team_owner",
  quotes: [{ text: "Refunds <30d", source: "Policy", url: "https://r.test/source/a1" }],
  actions: [
    { kind: "ack" as const, url: `https://r.test/ack/${token}?r=seen` },
    { kind: "concern" as const, url: `https://r.test/ack/${token}?r=concern` },
    { kind: "not_relevant" as const, url: `https://r.test/ack/${token}?r=not_relevant` },
    { kind: "open" as const, url: "https://r.test/r/11111111-1111-1111-1111-111111111111" },
  ],
  deepLink: "https://r.test/items/decision/d1",
};
const msg = { subject: "Decision: d1", lines: ["Decision: d1 (team_owner)"], sections: [section] };

/** Mock Slack Web API: records calls; `limitFirstPost` answers the first chat.postMessage with 429. */
function slack(opts: { limitFirstPost?: boolean; noUser?: boolean } = {}) {
  const calls: { method: string; body: URLSearchParams }[] = [];
  let limited = !opts.limitFirstPost;
  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const method = String(url).split("/api/")[1];
    const body = init!.body as URLSearchParams;
    calls.push({ method, body });
    if (method === "chat.postMessage" && !limited) { limited = true; return new Response("{}", { status: 429, headers: { "retry-after": "2" } }); }
    const out: Record<string, unknown> = {
      "users.lookupByEmail": opts.noUser ? { ok: false, error: "users_not_found" } : { ok: true, user: { id: "U1" } },
      "conversations.open": { ok: true, channel: { id: "D1" } },
      "chat.postMessage": { ok: true, ts: "1700.01", channel: body.get("channel") },
    };
    return Response.json(out[method]);
  });
  const sleep = vi.fn(async () => {});
  return { calls, sleep, client: slackClient("xoxb-test", { fetch: fetch as never, sleep, now: () => 0 }) };
}

describe("slack adapter", () => {
  it("DM: looks up the user, opens the conversation and posts Block Kit with 4 actions; waits out a 429", async () => {
    const s = slack({ limitFirstPost: true });
    const r = await slackAdapter(s.client, () => undefined).send("slack_dm", { id: "p1", email: "a@x.test" }, msg);
    expect(r).toEqual({ status: "sent", providerId: "D1:1700.01" });
    expect(s.calls.map((c) => c.method)).toEqual(["users.lookupByEmail", "conversations.open", "chat.postMessage", "chat.postMessage"]);
    expect(s.sleep).toHaveBeenCalledWith(2000); // Retry-After honoured
    const post = s.calls[3].body;
    expect(post.get("channel")).toBe("D1");
    const blocks = JSON.parse(post.get("blocks")!) as { type: string; elements?: { action_id: string; value?: string; url?: string }[]; text?: { text: string } }[];
    expect(blocks.map((b) => b.type)).toEqual(["header", "section", "section", "actions"]);
    expect(blocks[2].text!.text).toContain("Refunds &lt;30d");
    const els = blocks[3].elements!;
    expect(els.map((e) => e.action_id)).toEqual(["ripple:ack:0", "ripple:concern:0", "ripple:not_relevant:0", "ripple:open:0"]);
    expect(els.slice(0, 3).every((e) => e.value === token)).toBe(true);
    expect(els[3].url).toBe("https://r.test/r/11111111-1111-1111-1111-111111111111");
  });

  it("team channel: posts to the team's channel without opening a DM; no channel set is a failure", async () => {
    const s = slack();
    const a = slackAdapter(s.client, (id) => (id === "p1" ? "C9" : undefined));
    expect(await a.send("slack_channel", { id: "p1", email: null }, msg)).toEqual({ status: "sent", providerId: "C9:1700.01" });
    expect(s.calls.map((c) => c.method)).toEqual(["chat.postMessage"]);
    expect((await a.send("slack_channel", { id: "p2", email: null }, msg)).status).toBe("failed");
  });

  it("no Slack user for the email is a failed delivery", async () => {
    const s = slack({ noUser: true });
    const r = await slackAdapter(s.client, () => undefined).send("slack_dm", { id: "p1", email: "ghost@x.test" }, msg);
    expect(r.status).toBe("failed");
    expect(s.calls.map((c) => c.method)).toEqual(["users.lookupByEmail"]);
  });
});

describe("routing brief.sent by Slack connection", () => {
  const graph = { revision: () => "0" } as unknown as GraphReader;
  const brief = RippleEvent.parse({ type: "brief.sent", orgId: "o", subject: { kind: "brief", id: "b1" }, payload: { briefId: "b1", userId: "p1" }, dedupeKey: "k" });
  const channels = (slackOn: boolean) => route(brief, graph, { get: () => undefined }, 1_800_000_000, { slack: slackOn })[0].channels;
  it("Slack DM + inbox when connected, email + inbox otherwise", () => {
    expect(channels(true)).toEqual(["slack_dm", "inbox"]);
    expect(channels(false)).toEqual(["email", "inbox"]);
  });
});

describe("composeAdapter", () => {
  it("sends slack_* through the Slack adapter when the org has one", async () => {
    const slackSend = vi.fn(async () => ({ status: "sent" as const, providerId: "x" }));
    const r = await composeAdapter({ send: slackSend }).send("slack_dm", { id: "p", email: null }, msg);
    expect(r.providerId).toBe("x");
    expect(slackSend).toHaveBeenCalled();
  });
});
