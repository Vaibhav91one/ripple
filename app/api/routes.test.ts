// Route handlers against a temp seeded graph (never `demo`). Skips when FalkorDB is unreachable.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { closeClient, graphFor, query, type Graph } from "@/lib/graph/client";
import { seed } from "@/lib/ingest/seed";
import * as s from "@/lib/schemas";

const name = `test_r_${randomUUID().replaceAll("-", "")}`;
let g: Graph;
let up = false;

beforeAll(async () => {
  process.env.RIPPLE_GRAPH = name;
  process.env.RIPPLE_NOW = "2026-10-17T09:00:00Z";
  process.env.RIPPLE_VIEW_AS = "legal,sales,security,leadership"; // sees every payload; lib/permissions tests the restricted views
  try {
    g = await graphFor(name);
    await query(g, "RETURN 1");
    up = true;
    await seed(name);
  } catch (e) {
    console.warn(`SKIPPING route tests: FalkorDB unreachable (${String(e)})`);
  }
}, 30_000);

afterAll(async () => {
  try {
    if (up) await g.delete();
  } finally {
    await closeClient();
  }
});

const t = (title: string, fn: () => Promise<void>) =>
  it(title, async (ctx) => {
    if (!up) ctx.skip();
    await fn();
  });
const get = async (route: string, url: string, ctx?: unknown) => {
  const mod = await import(`./${route}/route`);
  return (mod.GET as (r: Request, c?: unknown) => Promise<Response>)(new Request(`http://t${url}`), ctx);
};
const ok = async <S extends z.ZodType>(schema: S, res: Response) => {
  expect(res.status).toBe(200);
  return schema.parse(await res.json());
};

describe("route handlers (in order: /api/change mutates the graph)", () => {
  t("GET /api/decisions", async () => {
    const d = await ok(z.array(s.Decision), await get("decisions", "/api/decisions"));
    expect(d.map((x) => x.id)).toEqual(["d-0", "d-1"]);
  });

  t("GET /api/ripple?d=d-1 has the demo counts", async () => {
    const r = await ok(s.RippleResult, await get("ripple", "/api/ripple?d=d-1"));
    expect(r.counts).toEqual({
      teamsAffected: 5, notTold: 3, conflicts: 1, customers: 40, tickets: 12, deals: 3, contracts: 2, arrAtRisk: 180_000,
    });
    expect(r.gap.sort()).toEqual(["devrel", "legal", "security"]);
  });

  t("GET /api/ripple: 400 without d, 404 for an unknown decision", async () => {
    expect((await get("ripple", "/api/ripple")).status).toBe(400);
    expect((await get("ripple", "/api/ripple?d=nope")).status).toBe(404);
  });

  t("GET /api/changes?since=", async () => {
    const all = await ok(z.array(s.Change), await get("changes", "/api/changes?since=0"));
    expect(all.length).toBeGreaterThan(0);
    const none = await ok(z.array(s.Change), await get("changes", "/api/changes?since=9999999999"));
    expect(none).toEqual([]);
    expect((await get("changes", "/api/changes?since=abc")).status).toBe(400);
  });

  t("GET /api/bottleneck", async () => {
    const b = await ok(z.array(s.BottleneckRow), await get("bottleneck", "/api/bottleneck"));
    expect(b.map((x) => [x.blockerTeamId, x.openRequests])).toEqual([["legal", 4], ["security", 3], ["eng", 2]]);
  });

  t("GET /api/inbox?p=p-priya", async () => {
    const { forMe, sent } = await ok(s.Inbox, await get("inbox", "/api/inbox?p=p-priya"));
    // the briefs she sends are not hers to acknowledge
    expect(forMe.filter((i) => i.kind === "brief")).toEqual([]);
    expect(sent.map((i) => [i.teamId, i.status])).toEqual(
      expect.arrayContaining([["devrel", "pending"], ["legal", "pending"], ["security", "pending"], ["support", "acked"], ["sales", "acked"]]),
    );
    expect(sent).toHaveLength(5);
    expect(forMe.find((i) => i.kind === "review")).toMatchObject({ taskId: "task-2", from: "p-prod" });
    expect(forMe.filter((i) => i.kind === "waiting")).toHaveLength(2);
    expect(await ok(s.Inbox, await get("inbox", "/api/inbox?p=nobody"))).toEqual({ forMe: [], sent: [] });
    // a team in the gap gets the brief in forMe and has sent nothing
    const mei = await ok(s.Inbox, await get("inbox", "/api/inbox?p=p-mei"));
    expect(mei.forMe.filter((i) => i.kind === "brief")).toHaveLength(1);
    expect(mei.sent).toEqual([]);
  });

  t("GET /api/home composes inbox, hits, tasks and signed ack tokens for the viewer's team", async () => {
    const h = await ok(s.Home, await get("home", "/api/home")); // RIPPLE_VIEW_AS starts with legal
    expect(h.teamId).toBe("legal");
    expect(h.briefs).toHaveLength(1);
    expect(h.briefs[0].tokens).toBeNull(); // anonymous viewer: no ack tokens
    expect(JSON.stringify(h)).not.toMatch(/"seen":/);
    expect(h.hits.map((x) => [x.decisionId, x.status])).toEqual([["d-1", "conflict"]]);
    expect(h.conflicts).toBe(1);
    expect(h.tasks.map((x) => x.id)).toEqual(["task-7"]);
    expect(h.approvals).toEqual([]); // no Postgres here
  });

  t("GET /api/source/[id]", async () => {
    const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
    const a = await ok(s.Artifact, await get("source/[id]", "/api/source/art-rfc14", ctx("art-rfc14")));
    expect(a.docKind).toBe("rfc");
    expect(a.text).toContain("API v1 will be shut down on Jan 31, 2027");
    expect((await get("source/[id]", "/api/source/nope", ctx("nope"))).status).toBe(404);
  });

  t("GET /api/who-knows?system=api-v1", async () => {
    const w = await ok(z.array(s.WhoKnowsRow), await get("who-knows", "/api/who-knows?system=api-v1"));
    expect(w[0]).toMatchObject({ personId: "p-priya", authored: 10 }); // 9 PRs + the auth-handler edge (mock says 9);
  });

  t("GET /api/people and /api/names", async () => {
    const p = await ok(z.array(s.Person), await get("people", "/api/people"));
    expect(p).toHaveLength(31);
    const n = await ok(z.record(z.string(), z.string()), await get("names", "/api/names"));
    expect(n).toMatchObject({ legal: "Legal", "p-priya": "Priya", "api-v1": "API v1", "d-1": "Sunset API v1 on Jan 31" });
  });

  t("POST /api/change moves the sunset past the guarantees", async () => {
    const { POST } = await import("./change/route");
    const post = (body: unknown) =>
      POST(new Request("http://t/api/change", { method: "POST", body: JSON.stringify(body) }));
    expect((await post({ decisionId: "d-1" })).status).toBe(400);
    expect((await post({ decisionId: "nope", newOn: 1 })).status).toBe(404);
    const r = await ok(s.RippleResult, await post({ decisionId: "d-1", newOn: Date.UTC(2027, 6, 15) / 1000 }));
    expect(r.counts).toMatchObject({ conflicts: 0, arrAtRisk: 0, customers: 40 });
  });
});
