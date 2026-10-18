// Reports, activity and analytics routes against a temp seeded graph (never `demo`). Skips when FalkorDB is unreachable.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { agentStats } from "@/lib/analytics";
import { closeClient, graphFor, query, type Graph } from "@/lib/graph/client";
import { seed } from "@/lib/ingest/seed";
import { isCase, pendingEvents, touches } from "@/lib/reports-db";
import { Analytics } from "@/lib/schemas/analytics";
import { Activity, ReportDetail, ReportList } from "@/lib/schemas/reports";

vi.mock("server-only", () => ({}));
const name = `test_r_${randomUUID().replaceAll("-", "")}`;
let g: Graph;
let up = false;

beforeAll(async () => {
  process.env.RIPPLE_GRAPH = name;
  process.env.RIPPLE_NOW = "2026-10-17T09:00:00Z";
  delete process.env.DATABASE_URL; // no Postgres: graph-only plus labelled demo history
  as("legal,sales,security,leadership");
  try {
    g = await graphFor(name);
    await query(g, "RETURN 1");
    up = true;
    await seed(name);
  } catch (e) {
    console.warn(`SKIPPING reports route tests: FalkorDB unreachable (${String(e)})`);
  }
}, 30_000);
afterAll(async () => {
  try {
    if (up) await g.delete();
  } finally {
    await closeClient();
  }
});

const as = (teams: string) => { process.env.RIPPLE_VIEW_AS = teams; process.env.RIPPLE_VIEW_ROLE = ""; };
const t = (title: string, fn: () => Promise<void>) => it(title, async (ctx) => { if (!up) ctx.skip(); await fn(); });
const get = async (path: string, p?: Record<string, string>) => {
  const url = new URL(`http://t${path}`);
  const route = url.pathname === "/api/reports" ? await import("./reports/route")
    : url.pathname === "/api/activity" ? await import("./activity/route")
    : url.pathname === "/api/analytics" ? await import("./analytics/route")
    : await import("./reports/[id]/route");
  const res = await (route.GET as (r: Request, c: { params: Promise<Record<string, string>> }) => Promise<Response>)(new Request(url), { params: Promise.resolve(p ?? {}) });
  return { status: res.status, body: await res.json() };
};

describe("GET /api/reports", () => {
  t("lists the sunset change with coverage, ARR and the main gap", async () => {
    const r = await get("/api/reports");
    expect(r.status).toBe(200);
    const l = ReportList.parse(r.body);
    const c = l.cases.find((x) => x.id === "d-1")!;
    expect(c).toMatchObject({ state: "blocked", needsYou: true, openConflicts: 1, arrAtRisk: 180000, coverage: { told: 2, affected: 5, pct: 40 } });
    expect(c.systems[0].id).toBe("api-v1");
    expect(c.mainGap?.teamId).toBe("legal");
    expect(l.summary.needYou).toBeGreaterThan(0);
  });
});

describe("GET /api/reports/[id]", () => {
  t("returns the case file: teams, merged timeline, conflicts, result", async () => {
    const r = await get("/api/reports/d-1", { id: "d-1" });
    expect(r.status).toBe(200);
    const d = ReportDetail.parse(r.body);
    expect(d.teams.map((x) => [x.teamId, x.status]).sort()).toEqual([["devrel", "not_told"], ["legal", "not_told"], ["sales", "acked"], ["security", "not_told"], ["support", "acked"]]);
    const kinds = new Set(d.timeline.map((e) => e.kind));
    expect(["announced", "ack", "conflict", "traversed", "notified"].every((k) => kinds.has(k as never))).toBe(true);
    // every seeded row is labelled
    expect(d.timeline.filter((e) => e.source === "demo").every((e) => e.demo)).toBe(true);
    expect(d.timeline.filter((e) => e.source !== "demo").every((e) => !e.demo)).toBe(true);
    expect(d.timeline.map((e) => e.at)).toEqual([...d.timeline.map((e) => e.at)].sort((a, b) => a - b));
    expect(d.conflicts[0].contracts.map((c) => c.name)).toContain("Northwind Capital MSA");
    expect(d.result).toMatchObject({ teamsTold: 2, openGaps: 3, noticesSent: 12, noticesSentDemo: true });
    expect(d.announcedBy?.name).toBeTruthy();
  });
  t("404 for an unknown change", async () => {
    expect((await get("/api/reports/nope", { id: "nope" })).status).toBe(404);
  });
});

describe("GET /api/activity", () => {
  t("merges events across cases and filters by actor", async () => {
    const all = Activity.parse((await get("/api/activity")).body);
    expect(all.items.length).toBeGreaterThan(5);
    expect(all.items.every((e) => e.caseId === "d-1")).toBe(true);
    expect(all.items.map((e) => e.at)).toEqual([...all.items.map((e) => e.at)].sort((a, b) => b - a));
    const agent = Activity.parse((await get("/api/activity?actor=agent&limit=3")).body);
    expect(agent.items.length).toBeGreaterThan(0);
    expect(agent.items.every((e) => e.actor.type === "agent")).toBe(true);
    expect((await get("/api/activity?actor=robot")).status).toBe(400);
  });
});

describe("GET /api/analytics", () => {
  t("coverage, waterfall, heatmap, forecast, time to tell, agent stats", async () => {
    const r = await get("/api/analytics");
    expect(r.status).toBe(200);
    const a = Analytics.parse(r.body);
    expect(a.coverage).toMatchObject({ caseId: "d-1", pct: 40, teams: { told: 2, affected: 5 }, acks: { done: 2, of: 5 } });
    expect(a.coverage!.trend.at(-1)).toMatchObject({ today: true, pct: 40 });
    expect(a.coverage!.trend[0].pct).toBe(0);
    expect(a.waterfall!.steps.reduce((s, x) => s + x.pts, 0)).toBe(100 - 40);
    expect(a.waterfall!.steps.find((s) => s.teamId === "legal")?.arrAtRisk).toBe(180000);
    expect(a.heatmap.cells.some((c) => c.teamId === "legal" && c.gap === "contract_conflict")).toBe(true);
    expect(a.heatmap.cells.filter((c) => c.arrAtRisk !== null)).toHaveLength(1); // ARR sits on one cell only
    expect(a.coverage!.trend).toHaveLength(26);
    expect(a.waterfall!.takeaway).toBe("Legal and DevRel explain 67% of the 60 point gap.");
    expect(a.forecast).toMatchObject({ currentPct: 40, withApprovalsPct: 40 }); // derived scenarios are not real actions
    expect(a.forecast!.scenarios).toHaveLength(3);
    expect(a.timeToTell.rows.find((x) => x.teamId === "support")?.hours).toBe(24);
    expect(a.timeToTell.rows.find((x) => x.teamId === "legal")?.hours).toBeNull();
    expect(a.agents.demo).toBe(true);
  });
  t("404 for an unknown case", async () => {
    expect((await get("/api/analytics?case=nope")).status).toBe(404);
  });
});

describe("redaction", () => {
  t("another team sees no ARR, contract names or quotes", async () => {
    as("support");
    const [d, l, a] = [await get("/api/reports/d-1", { id: "d-1" }), await get("/api/reports"), await get("/api/analytics")];
    expect(d.status).toBe(200);
    const text = JSON.stringify([d.body, l.body, a.body]);
    expect(text).not.toContain("Northwind");
    expect(text).not.toContain("180000");
    expect(l.body.cases[0].arrAtRisk).toBeNull();
    expect(d.body.conflicts[0].contracts).toEqual([]);
    expect(d.body.restricted?.length).toBeGreaterThan(0);
    expect(a.body.waterfall.steps.every((s: { arrAtRisk: number | null }) => s.arrAtRisk === null)).toBe(true);
    expect(a.body.heatmap.cells.every((c: { arrAtRisk: number | null }) => c.arrAtRisk === null)).toBe(true);
    as("legal,sales,security,leadership");
  });
});

describe("postgres mappers", () => {
  it("links by exact id and turns an executed create_issue into an issue event with its url", () => {
    expect(touches("d-1", { decisionId: "d-1" })).toBe(true);
    expect(touches("d-1", { decisionId: "d-10" })).toBe(false);
    const at = new Date("2026-10-02T10:00:00Z");
    const gh = { id: "g", kind: "create_issue", status: "executed", payload: { title: "Migrate off v1 (d-1)", body: "" }, requestedAt: at, approver: "p-ana", decidedAt: at, result: { status: "created", url: "https://github.com/o/r/issues/7" } };
    expect(isCase("d-1", gh)).toBe(true);
    expect(isCase("d-10", { ...gh, payload: { title: "x", body: "see d-1" } })).toBe(false);
    expect(pendingEvents([gh], "d-1", (i) => i)).toMatchObject([{ kind: "issue", url: "https://github.com/o/r/issues/7", demo: false }]);
  });
  it("turns pending actions into propose + approve events and counts approval stats", () => {
    const req = new Date("2026-10-01T10:00:00Z");
    const rows = [
      { id: "a", kind: "notice", status: "executed", payload: { decisionId: "d-1" }, requestedAt: req, approver: "p-ana", decidedAt: new Date(+req + 2 * 3.6e6) },
      { id: "b", kind: "email", status: "rejected", payload: { decisionId: "d-1" }, requestedAt: req, approver: "p-ana", decidedAt: new Date(+req + 4 * 3.6e6) },
      { id: "c", kind: "email", status: "pending", payload: { decisionId: "d-1" }, requestedAt: req, approver: null, decidedAt: null },
      { id: "x", kind: "faq", status: "pending", payload: { decisionId: "d-9" }, requestedAt: req, approver: null, decidedAt: null },
    ];
    const ev = pendingEvents(rows, "d-1", (i) => `Name ${i}`);
    expect(ev.map((e) => e.kind).sort()).toEqual(["approved", "proposed", "proposed", "proposed", "rejected"]);
    expect(ev.find((e) => e.kind === "approved")?.actor.name).toBe("Name p-ana");
    expect(ev.every((e) => !e.demo && e.source === "pending_actions")).toBe(true);
    const groups = [{ kind: "notice", status: "executed", n: 1 }, { kind: "email", status: "rejected", n: 1 }, { kind: "email", status: "pending", n: 2 }];
    expect(agentStats({ groups, medianHours: 2 }, false)).toMatchObject({ proposed: 4, approved: 1, rejected: 1, pending: 2, approvalRatePct: 50, medianDecisionHours: 2, demo: false });
    expect(agentStats(null, true).demo).toBe(true);
    expect(agentStats({ groups: [], medianHours: null }, false)).toMatchObject({ proposed: 0, demo: false }); // empty table is not demo on a real org
    expect(agentStats({ groups: [], medianHours: null }, true).demo).toBe(true); // demo org
  });
});
