import { createHmac, generateKeyPairSync, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createIssue } from "../../actions/executors";
import { closeClient, graphFor, query, type Graph } from "../../graph/client";
import { applyProposal } from "../apply";
import { GraphProposal } from "../define";
import { matchPath, parseCodeowners, resolveOwner, type Directory } from "./codeowners";
import { github } from "./index";
import { mapGithub } from "./map";
import { ownedIn, syncGithub, type Octo } from "./sync";
import { ensureSchema } from "../../graph/schema";
import { search } from "../../graph/queries";

vi.mock("server-only", () => ({}));
vi.mock("../../queue", () => ({ enqueue: vi.fn(async () => "job") }));

const SECRET = "whsec_test";
const sign = (body: string) => `sha256=${createHmac("sha256", SECRET).update(body).digest("hex")}`;
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });

// Recorded-shape fixtures: what the GitHub API returns for the calls the sync makes.
const CODEOWNERS = `# who owns what
* @acme/platform
/api/ @acme/platform @ana-gh
[Billing]
/billing/ @acme/billing dev@acme.test
/docs/ @nobody-we-know
`;
const dir: Directory = {
  teams: [{ id: "t-platform", name: "Platform" }, { id: "t-billing", name: "Billing" }],
  people: [{ id: "p-ana", github: "Ana-GH" }, { id: "p-dev", email: "dev@acme.test" }, { id: "p-sam", github: "sam" }],
};
const NOW = Date.parse("2026-10-10T00:00:00Z");
const recorded: Record<string, unknown> = {
  "GET /installation/repositories": { repositories: [{ full_name: "acme/shop", html_url: "https://github.com/acme/shop" }] },
  "GET /repos/{owner}/{repo}/contents/.github/CODEOWNERS": { content: Buffer.from(CODEOWNERS).toString("base64") },
  "GET /repos/{owner}/{repo}/pulls": [
    { number: 12, title: "Fix invoice rounding", body: "Rounds half up", html_url: "https://github.com/acme/shop/pull/12", state: "closed", created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-02T00:00:00Z", user: { login: "ana-gh" } },
    { number: 3, title: "Ancient PR", body: null, html_url: "https://github.com/acme/shop/pull/3", state: "closed", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-02T00:00:00Z", user: { login: "sam" } },
  ],
  "GET /repos/{owner}/{repo}/pulls/{pull_number}/files": [{ filename: "billing/invoice.ts" }],
  "GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews": [{ user: { login: "sam" } }, { user: { login: "ana-gh" } }, { user: { login: "stranger" } }],
};
const octo: Octo = {
  request: async (route, params) => {
    const key = route === "GET /repos/{owner}/{repo}/contents/{path}" ? `${route.replace("{path}", String(params?.path))}` : route;
    if (!(key in recorded)) throw Object.assign(new Error("Not Found"), { status: 404 });
    return { data: recorded[key] };
  },
};

describe("CODEOWNERS", () => {
  it("parses sections, comments and multiple owners", () => {
    expect(parseCodeowners(CODEOWNERS)).toEqual([
      { pattern: "*", owners: ["@acme/platform"] },
      { pattern: "/api/", owners: ["@acme/platform", "@ana-gh"] },
      { pattern: "/billing/", owners: ["@acme/billing", "dev@acme.test"], section: "Billing" },
      { pattern: "/docs/", owners: ["@nobody-we-know"], section: "Billing" },
    ]);
  });
  it("matches paths like CODEOWNERS", () => {
    expect(matchPath("/billing/", "billing/invoice.ts")).toBe(true);
    expect(matchPath("/billing/", "src/billing/x.ts")).toBe(false);
    expect(matchPath("*.md", "docs/a/readme.md")).toBe(true);
    expect(matchPath("docs/**/*.md", "docs/a/b.md")).toBe(true);
  });
  it("resolves teams by name, people by login (any case) or email, and returns null for strangers", () => {
    expect(resolveOwner("@acme/billing", dir)).toEqual({ label: "Team", id: "t-billing" });
    expect(resolveOwner("@ANA-gh", dir)).toEqual({ label: "Person", id: "p-ana" });
    expect(resolveOwner("dev@acme.test", dir)).toEqual({ label: "Person", id: "p-dev" });
    expect(resolveOwner("@acme/unknown", dir)).toBeNull();
  });
});

describe("sync -> graph (recorded API responses, real FalkorDB)", () => {
  const gname = `test_gh_${randomUUID().replaceAll("-", "")}`;
  let g: Graph;
  beforeAll(async () => {
    g = await graphFor(gname);
    await ensureSchema(g);
    for (const t of dir.teams) await query(g, "CREATE (:Team {id: $id, name: $name})", { id: t.id, name: t.name });
    for (const p of dir.people) await query(g, "CREATE (:Person {id: $id})", { id: p.id });
  }, 30_000);
  afterAll(async () => { await g?.delete(); await closeClient(); });

  it("writes the repo, path systems, ownership, PR and its edges", async () => {
    const acct = { id: "a", orgId: "o", kind: "github", externalId: "1", token: "1", scopes: [] };
    const pages = [];
    for await (const page of syncGithub(acct, null, { octo, dir, owned: async () => [], now: NOW })) pages.push(page);
    expect(pages).toHaveLength(1);
    expect(pages[0].nextCursor).toBeNull();
    expect(pages[0].records).toHaveLength(2); // the repo + PR 12; PR 3 is older than 90 days

    for (const rec of pages[0].records) for (const raw of mapGithub(rec)) await applyProposal(g, GraphProposal.parse(raw), 1);
    const edges = await query<{ a: string; t: string; b: string }>(g, "MATCH (a)-[r]->(b) RETURN a.id AS a, type(r) AS t, b.id AS b ORDER BY a, t, b");
    expect(edges.map((e) => `${e.a} ${e.t} ${e.b}`)).toEqual([
      "gh:acme/shop OWNED_BY t-platform", // the `*` rule lands on the repo itself
      "gh:acme/shop#12 ABOUT gh:acme/shop",
      "gh:acme/shop#12 ABOUT gh:acme/shop:/billing/", // changed file billing/invoice.ts
      "gh:acme/shop:/api/ OWNED_BY p-ana",
      "gh:acme/shop:/api/ OWNED_BY t-platform",
      "gh:acme/shop:/billing/ OWNED_BY p-dev",
      "gh:acme/shop:/billing/ OWNED_BY t-billing",
      "p-ana AUTHORED gh:acme/shop#12",
      "p-sam REVIEWED gh:acme/shop#12", // the author's own review and an unknown reviewer are skipped
    ]);
    const [pr] = await query<{ kind: string; status: string }>(g, "MATCH (p:PR {id: 'gh:acme/shop#12'}) RETURN p.kind AS kind, p.status AS status");
    expect(pr).toEqual({ kind: "pr", status: "closed" });
  });

  it("a synced PR looks like a seeded one: :PR:Artifact, found by full-text search, served by /api/items/pr/<id>", async () => {
    const [labels] = await query<{ l: string[] }>(g, "MATCH (p {id: 'gh:acme/shop#12'}) RETURN labels(p) AS l");
    expect([...labels.l].sort()).toEqual(["Artifact", "PR"]);
    const [props] = await query<{ author: string; title: string; ts: number; uri: string; text: string }>(g, "MATCH (p:PR {id: 'gh:acme/shop#12'}) RETURN p.author AS author, p.title AS title, p.ts AS ts, p.uri AS uri, p.text AS text");
    expect(props).toMatchObject({ author: "p-ana", title: "Fix invoice rounding", uri: "https://github.com/acme/shop/pull/12" });
    expect(props.text).toContain("Rounds half up");
    const hits = await search(g, "invoice");
    expect(hits.data.map((h) => h.id)).toContain("gh:acme/shop#12");

    vi.stubEnv("RIPPLE_GRAPH", gname);
    const { GET } = await import("../../../app/api/items/[kind]/[id]/route");
    const res = await GET(new Request("http://t/api/items/pr/x"), { params: Promise.resolve({ kind: "pr", id: "gh:acme/shop#12" }) });
    vi.unstubAllEnvs();
    expect(res.status).toBe(200);
    expect(JSON.stringify(await res.json())).toContain("Fix invoice rounding");
  });

  it("ends OWNED_BY edges that CODEOWNERS no longer lists, and keeps the new ones current", async () => {
    const acct = { id: "a", orgId: "o", kind: "github", externalId: "1", token: "1", scopes: [] };
    const changed = `* @acme/platform\n/api/ @ana-gh\n`; // billing section gone, platform dropped from /api/
    const run = async (codeowners: string, now: number) => {
      recorded["GET /repos/{owner}/{repo}/contents/.github/CODEOWNERS"] = { content: Buffer.from(codeowners).toString("base64") };
      for await (const page of syncGithub(acct, null, { octo, dir, owned: (f) => ownedIn(g, f), now: NOW }))
        for (const rec of page.records) for (const raw of mapGithub(rec)) await applyProposal(g, GraphProposal.parse(raw), now);
    };
    await run(CODEOWNERS, 10);
    await run(changed, 20);
    const edges = await query<{ sys: string; owner: string; to: number | null }>(g, "MATCH (s:System)-[r:OWNED_BY]->(o) RETURN s.id AS sys, o.id AS owner, r.valid_to AS to ORDER BY sys, owner");
    const state = Object.fromEntries(edges.map((e) => [`${e.sys} ${e.owner}`, e.to]));
    expect(state["gh:acme/shop:/api/ t-platform"]).toBe(20); // removed owner: ended
    expect(state["gh:acme/shop:/billing/ t-billing"]).toBe(20); // whole section disappeared
    expect(state["gh:acme/shop:/billing/ p-dev"]).toBe(20);
    expect(state["gh:acme/shop:/api/ p-ana"] ?? null).toBeNull(); // still listed: current
    expect(state["gh:acme/shop t-platform"] ?? null).toBeNull();
    recorded["GET /repos/{owner}/{repo}/contents/.github/CODEOWNERS"] = { content: Buffer.from(CODEOWNERS).toString("base64") };
  });

  it("resumes after the cursor", async () => {
    const acct = { id: "a", orgId: "o", kind: "github", externalId: "1", token: "1", scopes: [] };
    const pages = [];
    for await (const page of syncGithub(acct, "acme/shop", { octo, dir, owned: async () => [], now: NOW })) pages.push(page);
    expect(pages).toHaveLength(0);
  });
});

describe("webhook", () => {
  const body = JSON.stringify({ action: "opened", number: 7, pull_request: { html_url: "https://github.com/acme/shop/pull/7" }, repository: { full_name: "acme/shop" }, installation: { id: 99 } });
  const req = (sig: string | null, event = "pull_request") =>
    new Request("http://t/api/connectors/github/webhook", { method: "POST", body, headers: { "x-github-event": event, "x-github-delivery": "d-1", ...(sig ? { "x-hub-signature-256": sig } : {}) } });
  const acct = { id: "a", orgId: "org-1", kind: "github", externalId: "99", token: null, scopes: [] };

  it("a bad signature gets 401 from the route", async () => {
    vi.stubEnv("GITHUB_APP_WEBHOOK_SECRET", SECRET);
    const { POST } = await import("../../../app/api/connectors/github/webhook/route");
    expect((await POST(req("sha256=deadbeef"))).status).toBe(401);
    expect((await POST(req(null))).status).toBe(401);
    vi.unstubAllEnvs();
  });
  it("a good signature becomes a pr.opened event keyed by the delivery id; a bad one throws", async () => {
    vi.stubEnv("GITHUB_APP_WEBHOOK_SECRET", SECRET);
    expect(await github.webhook!(req(sign(body)), acct)).toEqual([
      { type: "pr.opened", orgId: "org-1", subject: { kind: "pr", id: "gh:acme/shop#7" }, payload: { url: "https://github.com/acme/shop/pull/7" }, dedupeKey: "github:d-1" },
    ]);
    expect(await github.webhook!(req(sign(body), "ping"), acct)).toBe("ignored");
    await expect(github.webhook!(req("sha256=00"), acct)).rejects.toThrow("bad signature");
    vi.unstubAllEnvs();
  });
});

describe("create_issue through the octokit client (mocked API)", () => {
  it("mints an installation token and creates the issue", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      calls.push(`${init?.method ?? "GET"} ${new URL(u).pathname}`);
      const json = (o: object, status = 201) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
      if (u.endsWith("/app/installations/42/access_tokens")) return json({ token: "ghs_faketoken", expires_at: new Date(Date.now() + 3_600_000).toISOString(), permissions: {}, repository_selection: "all" });
      if (u.endsWith("/repos/acme/shop/issues")) {
        expect(new Headers(init?.headers).get("authorization")).toBe("token ghs_faketoken");
        expect(JSON.parse(String(init?.body))).toEqual({ title: "T", body: "B" });
        return json({ html_url: "https://github.com/acme/shop/issues/1" });
      }
      return json({ message: "unexpected" }, 500);
    }));
    const e = { GITHUB_APP_ID: "123", GITHUB_APP_PRIVATE_KEY: privateKey, GITHUB_APP_INSTALLATION_ID: "42", GITHUB_REPO: "acme/shop" };
    expect(await createIssue(e, "T", "B")).toEqual({ status: "created", url: "https://github.com/acme/shop/issues/1" });
    expect(calls).toEqual(["POST /app/installations/42/access_tokens", "POST /repos/acme/shop/issues"]);
    expect(await createIssue({ ...e, GITHUB_REPO: undefined }, "T", "B")).toEqual({ status: "skipped" });
    vi.unstubAllGlobals();
  });
  it("reports a GitHub failure without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "Bad credentials" }), { status: 401, headers: { "content-type": "application/json" } })));
    const r = await createIssue({ GITHUB_APP_ID: "124", GITHUB_APP_PRIVATE_KEY: privateKey, GITHUB_APP_INSTALLATION_ID: "42", GITHUB_REPO: "acme/shop" }, "T", "B");
    expect(r.status).toBe("failed");
    vi.unstubAllGlobals();
  });
});
