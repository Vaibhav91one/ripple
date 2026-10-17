import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decrypt } from "../../crypto";
import { slackClient } from "./client";
import { ingest } from "./ingest";
import { authorizeUrl, completeInstall } from "./install";
import { signSlack, verifySlack } from "./verify";

vi.mock("server-only", () => ({}));
vi.mock("../../db", () => ({ db: () => ({}) }));
const SECRET = "shh-signing-secret";
const saved = { ...process.env };
beforeEach(() => {
  process.env.SLACK_SIGNING_SECRET = SECRET;
  process.env.SLACK_CLIENT_ID = "cid";
  process.env.SLACK_CLIENT_SECRET = "csecret";
  process.env.APP_URL = "https://ripple.test";
  process.env.RIPPLE_SECRET_KEY = Buffer.alloc(32, 7).toString("base64");
});
afterEach(() => { process.env = { ...saved }; });

const post = (path: string, body: string, headers: Record<string, string>) => new Request(`https://ripple.test/api/slack/${path}`, { method: "POST", body, headers });
const accounts = async () => [{ id: "acct-1", orgId: "org-1" }];

describe("verifySlack", () => {
  const now = 1_700_000_000;
  it("accepts a good signature", () => {
    expect(verifySlack("a=b", new Headers(signSlack("a=b", SECRET, now)), SECRET, now)).toBe(true);
  });
  it("rejects a bad signature, tampered body, wrong secret, old timestamp and no secret", () => {
    const h = new Headers(signSlack("a=b", SECRET, now));
    expect(verifySlack("a=c", h, SECRET, now)).toBe(false);
    expect(verifySlack("a=b", h, "other", now)).toBe(false);
    expect(verifySlack("a=b", new Headers({ ...signSlack("a=b", SECRET, now), "x-slack-signature": "v0=00" }), SECRET, now)).toBe(false);
    expect(verifySlack("a=b", h, SECRET, now + 301)).toBe(false);
    expect(verifySlack("a=b", h, undefined, now)).toBe(false);
  });
});

describe("ingest", () => {
  it("401 on a bad signature and on an old timestamp", async () => {
    const body = JSON.stringify({ type: "url_verification", challenge: "c" });
    expect((await ingest(post("events", body, { ...signSlack(body, "wrong") }), "events", { hasDb: false, accounts })).status).toBe(401);
    const old = signSlack(body, SECRET, Math.floor(Date.now() / 1000) - 600);
    expect((await ingest(post("events", body, old), "events", { hasDb: false, accounts })).status).toBe(401);
  });

  it("url_verification echoes the challenge", async () => {
    const body = JSON.stringify({ type: "url_verification", challenge: "abc123" });
    const res = await ingest(post("events", body, signSlack(body, SECRET)), "events", { hasDb: false, accounts });
    expect(await res.json()).toEqual({ challenge: "abc123" });
  });

  it("acks events and enqueues once per event_id key", async () => {
    const enq = vi.fn(async () => "job");
    const body = JSON.stringify({ type: "event_callback", team_id: "T1", event_id: "Ev1", event: { type: "message", text: "hi" } });
    const res = await ingest(post("events", body, signSlack(body, SECRET)), "events", { hasDb: false, accounts, enqueue: enq });
    expect(res.status).toBe(200);
    expect(enq).toHaveBeenCalledWith("slack-inbound", expect.objectContaining({ accountId: "acct-1", orgId: "org-1" }), { singletonKey: "slack:events:acct-1:Ev1" });
  });

  it("handles interactive payloads and slash commands (form encoded)", async () => {
    const enq = vi.fn(async () => "job");
    const payload = new URLSearchParams({ payload: JSON.stringify({ type: "block_actions", team: { id: "T1" }, trigger_id: "tr1" }) }).toString();
    expect((await ingest(post("interactive", payload, signSlack(payload, SECRET)), "interactive", { hasDb: false, accounts, enqueue: enq })).status).toBe(200);
    const cmd = new URLSearchParams({ team_id: "T1", trigger_id: "tr2", command: "/ripple", text: "x" }).toString();
    expect((await ingest(post("command", cmd, signSlack(cmd, SECRET)), "command", { hasDb: false, accounts, enqueue: enq })).status).toBe(200);
    expect(enq.mock.calls.map((c) => (c as unknown as [string, object, { singletonKey: string }])[2].singletonKey)).toEqual(["slack:interactive:acct-1:tr1", "slack:command:acct-1:tr2"]);
  });
});

describe("install", () => {
  it("authorize URL carries scopes, redirect and state", () => {
    const u = new URL(authorizeUrl("st8"));
    expect(u.searchParams.get("redirect_uri")).toBe("https://ripple.test/api/slack/oauth");
    expect(u.searchParams.get("state")).toBe("st8");
    expect(u.searchParams.get("scope")).toContain("chat:write");
  });

  it("stores the bot token encrypted, never in plaintext", async () => {
    const save = vi.fn(async () => {});
    const fetchMock = vi.fn(async () => Response.json({ ok: true, access_token: "xoxb-secret-token", scope: "chat:write,commands", team: { id: "T9" } })) as unknown as typeof fetch;
    expect(await completeInstall("org-1", "code1", { fetch: fetchMock, save })).toBe("T9");
    const row = (save.mock.calls[0] as unknown as [{ tokenEnc: string; scopes: string[]; teamId: string; orgId: string }])[0];
    expect(row).toMatchObject({ orgId: "org-1", teamId: "T9", scopes: ["chat:write", "commands"] });
    expect(row.tokenEnc).not.toContain("xoxb");
    expect(decrypt(row.tokenEnc)).toBe("xoxb-secret-token");
  });

  it("a failed exchange saves nothing", async () => {
    const save = vi.fn(async () => {});
    const fetchMock = vi.fn(async () => Response.json({ ok: false, error: "invalid_code" })) as unknown as typeof fetch;
    await expect(completeInstall("org-1", "bad", { fetch: fetchMock, save })).rejects.toThrow("invalid_code");
    expect(save).not.toHaveBeenCalled();
  });
});

describe("slackClient", () => {
  it("429 waits Retry-After seconds, then retries", async () => {
    const sleep = vi.fn(async () => {});
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 429, headers: { "retry-after": "7" } }))
      .mockResolvedValueOnce(Response.json({ ok: true, user: { id: "U1" } }));
    const c = slackClient("xoxb-t", { fetch: fetchMock as unknown as typeof fetch, sleep });
    await expect(c.call("users.info", { user: "U1" })).resolves.toMatchObject({ ok: true });
    expect(sleep).toHaveBeenCalledWith(7000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after repeated 429s", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 429, headers: { "retry-after": "1" } }));
    const c = slackClient("t", { fetch: fetchMock as unknown as typeof fetch, sleep: async () => {} });
    await expect(c.call("x")).rejects.toThrow("ratelimited");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("spaces posts to one channel 1s apart, not other channels", async () => {
    let t = 1000;
    const sleep = vi.fn(async (ms: number) => { t += ms; });
    const fetchMock = vi.fn(async () => Response.json({ ok: true, ts: "1", channel: "C1" })) as unknown as typeof fetch;
    const c = slackClient("t", { fetch: fetchMock, sleep, now: () => t });
    await c.postMessage("C1", "a");
    await c.postMessage("C1", "b");
    expect(sleep).toHaveBeenCalledWith(1000);
    sleep.mockClear();
    await c.postMessage("C2", "c");
    expect(sleep).not.toHaveBeenCalled();
  });

  it("caches email lookups, and maps users_not_found to null", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ ok: true, user: { id: "U7" } }))
      .mockResolvedValueOnce(Response.json({ ok: false, error: "users_not_found" }));
    const c = slackClient("t", { fetch: fetchMock as unknown as typeof fetch });
    expect(await c.userIdByEmail("A@x.com")).toBe("U7");
    expect(await c.userIdByEmail("a@x.com")).toBe("U7");
    expect(await c.userIdByEmail("none@x.com")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("durable dedupe", () => {
  it("the same event_id delivered twice (after the first was processed) enqueues once", async () => {
    const seen = new Set<string>(); // stands in for the event table's unique dedupe_key, which outlives the queue job
    const em = vi.fn(async (_tx: unknown, ev: { dedupeKey: string }) => (seen.has(ev.dedupeKey) ? { inserted: false } : (seen.add(ev.dedupeKey), { inserted: true })));
    const enq = vi.fn(async () => "job");
    const body = JSON.stringify({ type: "event_callback", team_id: "T1", event_id: "EvDup", event: { type: "message" } });
    const send = () => ingest(post("events", body, signSlack(body, SECRET)), "events", { accounts, enqueue: enq, emit: em as never, hasDb: true });
    expect((await send()).status).toBe(200);
    expect((await send()).status).toBe(200); // Slack retry, long after the job finished
    expect(em).toHaveBeenCalledTimes(2);
    expect(enq).toHaveBeenCalledTimes(1);
    expect(em.mock.calls[0][1]).toMatchObject({ type: "slack.inbound", orgId: "org-1", dedupeKey: "slack:EvDup:org-1", payload: { kind: "event", teamId: "T1" } });
  });
});
