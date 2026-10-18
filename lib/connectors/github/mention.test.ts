import { createHmac, generateKeyPairSync } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildManifest } from "./manifest";
import manifestFile from "../../../github-app-manifest.json";
import { answerFor, handleCheck, handleMention, impactSummary, neutralize, parseMention, replyAllowed, resetLimiter, retrying, type MentionJob } from "./mention";
import { checkState, installationTaken, makeState } from "./setup";
import { saveApp, setupStatus, clearStoredApp } from "./app-creds";
import { encrypt } from "../../crypto";
import { convertManifest } from "./client";
import { PrComment, prComment } from "../../actions/executors";
import type { Octo } from "./sync";

vi.mock("server-only", () => ({}));
const enqueue = vi.fn(async () => "job");
vi.mock("../../queue", () => ({ enqueue: (...a: unknown[]) => (enqueue as (...a: unknown[]) => unknown)(...a) }));
const keys = new Set<string>();
let acctRows: { id: string; orgId: string }[] = [{ id: "acct-1", orgId: "org-1" }];
let storedRow: { t: string }[] = [];
vi.mock("../../db", () => ({ db: () => ({
  select: () => ({ from: () => ({ where: () => Object.assign(Promise.resolve(acctRows), { orderBy: () => ({ limit: async () => storedRow }) }) }) }),
  insert: () => ({ values: (v: { dedupeKey: string }) => ({ onConflictDoNothing: () => ({ returning: async () => (keys.has(v.dedupeKey) ? [] : (keys.add(v.dedupeKey), [{ id: "e" }])) }) }) }),
  delete: () => ({ where: async () => keys.clear() }),
}) }));

const SECRET = "whsec_test";
const SLUG = "ripple-company-brain";
const sign = (b: string) => `sha256=${createHmac("sha256", SECRET).update(b).digest("hex")}`;
const comment = (over: Record<string, unknown> = {}) => ({
  action: "created", sender: { type: "User", login: "ana" }, comment: { id: 55, body: "@ripple-company-brain what does this touch?", user: { login: "ana" }, author_association: "MEMBER" },
  issue: { number: 7, title: "Sunset v1", body: "details" }, repository: { full_name: "acme/shop" }, installation: { id: 99 }, ...over,
});

describe("parseMention", () => {
  it("detects @slug and strips it", () => {
    expect(parseMention("issue_comment", comment(), SLUG)).toMatchObject({ kind: "mention", repo: "acme/shop", number: 7, commentId: 55, review: false, text: "what does this touch?", author: "ana", installation: 99 });
  });
  it("detects a /ripple line and a review comment", () => {
    const p = comment({ comment: { id: 8, in_reply_to_id: 4, body: "thanks\n/ripple who owns billing?", author_association: "OWNER" }, issue: undefined, pull_request: { number: 3, title: "t" } });
    expect(parseMention("pull_request_review_comment", p, SLUG)).toMatchObject({ review: true, number: 3, replyTo: 4, text: "thanks\nwho owns billing?" });
  });
  it("ignores commenters who are not OWNER, MEMBER or COLLABORATOR", () => {
    for (const a of ["NONE", "CONTRIBUTOR", "FIRST_TIME_CONTRIBUTOR", undefined])
      expect(parseMention("issue_comment", comment({ comment: { id: 1, body: "@ripple-company-brain hi", author_association: a } }), SLUG)).toBeNull();
  });
  it("flags public repos", () => {
    expect(parseMention("issue_comment", comment({ repository: { full_name: "acme/shop", private: false } }), SLUG)?.publicRepo).toBe(true);
    expect(parseMention("issue_comment", comment({ repository: { full_name: "acme/shop", private: true } }), SLUG)?.publicRepo).toBe(false);
  });
  it("ignores plain comments, bots, our own bot login, edits and other events", () => {
    expect(parseMention("issue_comment", comment({ comment: { id: 1, body: "lgtm", author_association: "MEMBER" } }), SLUG)).toBeNull();
    expect(parseMention("issue_comment", comment({ comment: { id: 1, body: "mail me@ripple-company-brain.dev", author_association: "MEMBER" } }), SLUG)).toBeNull();
    expect(parseMention("issue_comment", comment({ sender: { type: "Bot", login: "dependabot[bot]" } }), SLUG)).toBeNull();
    expect(parseMention("issue_comment", comment({ sender: { type: "User", login: `${SLUG}[bot]` } }), SLUG)).toBeNull();
    expect(parseMention("issue_comment", comment({ action: "edited" }), SLUG)).toBeNull();
    expect(parseMention("issue_comment", comment({ comment: { id: 1, body: "/ripples" , author_association: "MEMBER" } }), SLUG)).toBeNull();
    expect(parseMention("push", comment(), SLUG)).toBeNull();
  });
});

describe("webhook route", () => {
  const send = async (event: string, payload: object, id: string, sig?: string) => {
    const { POST } = await import("../../../app/api/connectors/github/webhook/route");
    const body = JSON.stringify(payload);
    return POST(new Request("http://t/w", { method: "POST", body, headers: { "x-github-event": event, "x-github-delivery": id, "x-hub-signature-256": sig ?? sign(body) } }));
  };
  beforeEach(() => { keys.clear(); enqueue.mockClear(); resetLimiter(); acctRows = [{ id: "acct-1", orgId: "org-1" }]; storedRow = []; clearStoredApp(); vi.stubEnv("GITHUB_APP_WEBHOOK_SECRET", SECRET); vi.stubEnv("DATABASE_URL", "postgres://unused"); vi.stubEnv("GITHUB_APP_SLUG", SLUG); vi.stubEnv("ACK_TOKEN_SECRET", "test-secret"); });

  it("queues a mention once; a redelivery is a no-op", async () => {
    expect(await (await send("issue_comment", comment(), "d1")).json()).toMatchObject({ queued: "mention" });
    expect(await (await send("issue_comment", comment(), "d1")).json()).toMatchObject({ duplicate: true });
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith("github-reply", expect.objectContaining({ kind: "mention", repo: "acme/shop", commentId: 55, limited: false }), { singletonKey: "github:mention:d1" });
  });
  it("a failed enqueue forgets the delivery so GitHub's redelivery is processed", async () => {
    enqueue.mockResolvedValueOnce(null as never);
    await send("issue_comment", comment(), "d6");
    expect(await (await send("issue_comment", comment(), "d6")).json()).toMatchObject({ queued: "mention" });
  });
  it("past the hourly limit the job is queued as limited", async () => {
    vi.stubEnv("GITHUB_REPLIES_PER_HOUR", "1");
    await send("issue_comment", comment(), "d7");
    await send("issue_comment", comment({ comment: { id: 56, body: "@ripple-company-brain again", author_association: "OWNER" } }), "d8");
    expect((enqueue.mock.calls as unknown as [string, { limited?: boolean }][]).map((c) => c[1].limited)).toEqual([false, true]);
  });
  it("accepts a signature made with the stored app's secret as well as the env one", async () => {
    vi.stubEnv("GITHUB_APP_WEBHOOK_SECRET", "other-secret");
    storedRow = [{ t: encrypt(JSON.stringify({ id: 1, slug: SLUG, pem: "p", webhook_secret: SECRET })) }];
    expect((await send("issue_comment", comment(), "d9")).status).toBe(200);
    expect(enqueue).toHaveBeenCalledTimes(1);
  });
  it("ignores bot comments and edits without queueing", async () => {
    await send("issue_comment", comment({ sender: { type: "Bot", login: "x[bot]" } }), "d2");
    await send("issue_comment", comment({ action: "edited" }), "d3");
    expect(enqueue).not.toHaveBeenCalled();
  });
  it("401 on a bad signature", async () => {
    expect((await send("issue_comment", comment(), "d4", "sha256=bad")).status).toBe(401);
    expect(enqueue).not.toHaveBeenCalled();
  });
  it("pull_request opened queues a check once (the existing event path still runs)", async () => {
    const pr = { action: "opened", number: 7, pull_request: { head: { sha: "abc" }, html_url: "https://github.com/acme/shop/pull/7" }, repository: { full_name: "acme/shop" }, installation: { id: 99 } };
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { headers: { "content-type": "application/json" } })));
    await send("pull_request", pr, "d5").catch(() => undefined);
    await send("pull_request", pr, "d5").catch(() => undefined);
    expect((enqueue.mock.calls as unknown as [string, { kind: string }][]).filter((c) => c[1].kind === "check")).toEqual([["github-reply", { kind: "check", installation: 99, repo: "acme/shop", number: 7, headSha: "abc", url: "https://github.com/acme/shop/pull/7" }, { singletonKey: "github:check:d5" }]]);
    vi.unstubAllGlobals();
  });
});

const recorder = () => {
  const calls: { route: string; params: Record<string, unknown> }[] = [];
  const octo: Octo = { request: async (route, params = {}) => { calls.push({ route, params }); return { data: { id: 77, html_url: "https://github.com/acme/shop/issues/7#c" } }; } };
  return { calls, octo };
};
const job: MentionJob = { kind: "mention", installation: 99, repo: "acme/shop", number: 7, commentId: 55, replyTo: 55, publicRepo: false, review: false, text: "q", author: "ana", title: "t", context: "" };

describe("worker reply", () => {
  it("reacts eyes, then comments on the issue with the case-file link", async () => {
    const { calls, octo } = recorder();
    await handleMention(job, octo, async () => ({ text: "It touches billing. [1]", decisionId: "d-1" }), "https://ripple.test/");
    expect(calls.map((c) => c.route)).toEqual(["POST /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions", "POST /repos/{owner}/{repo}/issues/{issue_number}/comments"]);
    expect(calls[0].params).toMatchObject({ owner: "acme", repo: "shop", comment_id: 55, content: "eyes" });
    expect(calls[1].params.body).toBe("@ana It touches billing. [1]\n\n[Open the case file](https://ripple.test/reports/d-1)");
  });
  it("replies inside a review thread", async () => {
    const { calls, octo } = recorder();
    await handleMention({ ...job, review: true }, octo, async () => ({ text: "ok" }));
    expect(calls.map((c) => c.route)).toEqual(["POST /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions", "POST /repos/{owner}/{repo}/pulls/{pull_number}/comments/{comment_id}/replies"]);
  });
  it("still replies when the reaction or the answer fails", async () => {
    const calls: string[] = [];
    const octo: Octo = { request: async (r) => { calls.push(r); if (r.includes("reactions")) throw new Error("403"); return { data: {} }; } };
    await handleMention(job, octo, async () => { throw new Error("llm down"); });
    expect(calls.at(-1)).toBe("POST /repos/{owner}/{repo}/issues/{issue_number}/comments");
  });
});

describe("public repos, retries, neutral replies", () => {
  it("a public repo never reaches the org-wide agent", async () => {
    const agent = vi.fn(async () => ({ text: "customers" })), facts = vi.fn(async () => ({ text: "repo facts" }));
    await answerFor({ ...job, publicRepo: true }, agent, facts);
    expect(agent).not.toHaveBeenCalled();
    await answerFor(job, agent, facts);
    expect(agent).toHaveBeenCalledTimes(1);
  });
  it("neutralizes @mentions in the reply but keeps the asker ping", async () => {
    const { calls, octo } = recorder();
    await handleMention(job, octo, async () => ({ text: "cc @acme/legal and @bob" }));
    expect(calls[1].params.body).toBe("@ana cc @\u200bacme/legal and @\u200bbob");
    expect(neutralize("a@b")).toBe("a@\u200bb");
  });
  it("a rate limited mention gets a confused reaction and no reply", async () => {
    const { calls, octo } = recorder();
    await handleMention({ ...job, limited: true }, octo, async () => ({ text: "x" }));
    expect(calls).toHaveLength(1);
    expect(calls[0].params.content).toBe("confused");
    resetLimiter();
    expect([...Array(3)].map(() => replyAllowed(5, 1000, 2))).toEqual([true, true, false]);
    expect(replyAllowed(5, 1000 + 3_600_001, 2)).toBe(true);
  });
  it("replies into the thread root of a review comment", async () => {
    const { calls, octo } = recorder();
    await handleMention({ ...job, review: true, commentId: 9, replyTo: 4 }, octo, async () => ({ text: "ok" }));
    expect(calls[0].params.comment_id).toBe(9);
    expect(calls[1].params.comment_id).toBe(4);
  });
  it("retries 429, 5xx and 403 with retry-after (bounded), not plain 403/404", async () => {
    const waits: number[] = [];
    const sleep = async (ms: number) => { waits.push(ms); };
    let n = 0;
    const flaky: Octo = { request: async () => { if (n++ < 2) throw Object.assign(new Error("x"), { status: n === 1 ? 403 : 502, response: { headers: { "retry-after": "5" } } }); return { data: "ok" }; } };
    expect((await retrying(flaky, sleep).request("GET /x")).data).toBe("ok");
    expect(waits).toEqual([5000, 5000]);
    const nope: Octo = { request: async () => { throw Object.assign(new Error("x"), { status: 403 }); } };
    await expect(retrying(nope, sleep).request("GET /x")).rejects.toThrow();
    const always: Octo = { request: async () => { throw Object.assign(new Error("x"), { status: 500 }); } };
    await expect(retrying(always, sleep).request("GET /x")).rejects.toThrow();
  });
  it("the check run is completed even when impact fails", async () => {
    const { calls, octo } = recorder();
    await handleCheck({ kind: "check", installation: 99, repo: "acme/shop", number: 7, headSha: "abc", url: "u" }, octo, async () => { throw new Error("graph down"); });
    expect(calls[1].params).toMatchObject({ status: "completed", conclusion: "neutral" });
    expect((calls[1].params.output as { summary: string }).summary).toContain("could not compute");
  });
});

describe("Ripple impact check run", () => {
  it("creates in_progress, then completes neutral with the summary", async () => {
    const { calls, octo } = recorder();
    await handleCheck({ kind: "check", installation: 99, repo: "acme/shop", number: 7, headSha: "abc", url: "u" }, octo, async () => ({ systems: [{ id: "s1", name: "billing" }], teams: ["Finance"], decisionTitle: "Sunset v1" }));
    expect(calls[0]).toMatchObject({ route: "POST /repos/{owner}/{repo}/check-runs", params: { name: "Ripple impact", head_sha: "abc", status: "in_progress" } });
    expect(calls[1]).toMatchObject({ route: "PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}", params: { check_run_id: 77, status: "completed", conclusion: "neutral" } });
    expect((calls[1].params.output as { summary: string }).summary).toContain("Owned by: Finance");
    expect(impactSummary({ systems: [], teams: [] })).toMatch(/No mapped systems/);
  });
});

describe("pr_comment executor", () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
  it("validates the payload and posts as the installation", async () => {
    expect(PrComment.safeParse({ repo: "nope", number: 1, body: "x" }).success).toBe(false);
    const seen: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url); seen.push(`${init?.method ?? "GET"} ${new URL(u).pathname}`);
      const json = (o: object) => new Response(JSON.stringify(o), { status: 201, headers: { "content-type": "application/json" } });
      if (u.endsWith("/access_tokens")) return json({ token: "ghs_x", expires_at: new Date(Date.now() + 3_600_000).toISOString(), permissions: {}, repository_selection: "all" });
      expect(JSON.parse(String(init?.body))).toEqual({ body: "hello" });
      return json({ html_url: "https://github.com/acme/shop/pull/7#c" });
    }));
    const e = { GITHUB_APP_ID: "321", GITHUB_APP_PRIVATE_KEY: privateKey };
    expect(await prComment(e, "42", { repo: "acme/shop", number: 7, body: "hello" })).toEqual({ status: "created", url: "https://github.com/acme/shop/pull/7#c" });
    expect(seen).toEqual(["POST /app/installations/42/access_tokens", "POST /repos/acme/shop/issues/7/comments"]);
    expect(await prComment({}, undefined, { repo: "acme/shop", number: 7, body: "x" })).toEqual({ status: "skipped" });
    vi.unstubAllGlobals();
  });
});

describe("manifest flow", () => {
  beforeEach(() => vi.stubEnv("ACK_TOKEN_SECRET", "test-secret"));
  it("state is bound to the admin, purpose and org, expires, and is single use", () => {
    const s = makeState("u1");
    expect(checkState(s, "u1")).toBe(true);
    expect(checkState(s, "u2")).toBe(false);
    expect(checkState(s, "u1", "install")).toBe(false);
    expect(checkState(null, "u1")).toBe(false);
    expect(checkState("garbage", "u1")).toBe(false);
    expect(checkState(s, "u1", "manifest", undefined, false, Date.now() + 11 * 60_000)).toBe(false);
    const i = makeState("u1", "install", "org-1");
    expect(checkState(i, "u1", "install", "org-2")).toBe(false);
    expect(checkState(i, "u1", "install", "org-1", true)).toBe(true);
    expect(checkState(i, "u1", "install", "org-1", true)).toBe(false); // replay
  });
  it("a second app is refused once one exists (stored or env)", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://unused");
    expect(await setupStatus()).toBe("open");
    storedRow = [{ t: encrypt(JSON.stringify({ id: 1, slug: "a", pem: "p", webhook_secret: "w" })) }];
    expect(await setupStatus()).toBe("stored");
    await expect(saveApp("org-2", { id: 2, slug: "b", pem: "p", webhook_secret: "w2" })).rejects.toThrow("already configured");
    vi.stubEnv("GITHUB_APP_ID", "9"); vi.stubEnv("GITHUB_APP_PRIVATE_KEY", "k");
    expect(await setupStatus()).toBe("env");
  });
  it("rejects an installation already bound to another org", async () => {
    acctRows = [{ id: "x", orgId: "org-1" }];
    expect(await installationTaken("99", "org-2")).toBe(true);
    acctRows = [];
    expect(await installationTaken("99", "org-2")).toBe(false);
  });
  it("converts the code via POST /app-manifests/{code}/conversions", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ id: 5, slug: "my-ripple", pem: "PEM", webhook_secret: "ws", html_url: "https://github.com/apps/my-ripple" }), { status: 201 }));
    expect(await convertManifest("c0de", f as never)).toMatchObject({ id: 5, slug: "my-ripple" });
    expect(f).toHaveBeenCalledWith("https://api.github.com/app-manifests/c0de/conversions", expect.objectContaining({ method: "POST" }));
    await expect(convertManifest("bad", (async () => new Response("no", { status: 404 })) as never)).rejects.toThrow("404");
  });
  it("the file manifest is the hosted build of buildManifest", () => {
    expect(buildManifest("https://ripple.vaibhav.quest")).toEqual(manifestFile);
    expect(buildManifest("http://x/").default_events).toEqual(expect.arrayContaining(["issue_comment", "pull_request_review_comment"]));
  });
});
