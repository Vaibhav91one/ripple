// Team dashboards and the overview against a temp seeded graph (never `demo`). Skips when FalkorDB is unreachable.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeClient, graphFor, query, type Graph } from "@/lib/graph/client";
import { seed } from "@/lib/ingest/seed";
import { describeEdge } from "@/lib/changes";
import * as s from "@/lib/schemas";
import { TEAM_IDS, TeamDashboard, type TeamId } from "@/lib/teams/dashboards";
import { DevRelPayload } from "@/lib/teams/devrel/schema";
import { EngPayload } from "@/lib/teams/eng/schema";
import { LeadershipPayload } from "@/lib/teams/leadership/schema";
import { LegalPayload } from "@/lib/teams/legal/schema";
import { SalesPayload } from "@/lib/teams/sales/schema";
import { SecurityPayload } from "@/lib/teams/security/schema";
import { SupportPayload } from "@/lib/teams/support/schema";

const name = `test_t_${randomUUID().replaceAll("-", "")}`;
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
    console.warn(`SKIPPING team route tests: FalkorDB unreachable (${String(e)})`);
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
const team = async (id: string) => {
  const { GET } = await import("./teams/[team]/route");
  return GET(new Request(`http://t/api/teams/${id}`), { params: Promise.resolve({ team: id }) });
};
const dash = async (id: TeamId): Promise<unknown> => {
  const res = await team(id);
  expect(res.status).toBe(200);
  const body = await res.json();
  TeamDashboard.parse(body);
  return body;
};

describe("GET /api/teams/[team]", () => {
  t("404 for an unknown team", async () => {
    expect((await team("nope")).status).toBe(404);
  });

  t("every team returns a schema-valid payload with KPIs, 3-5 people and 1-3 sourced facts", async () => {
    const schemas = { eng: EngPayload, support: SupportPayload, sales: SalesPayload, legal: LegalPayload, security: SecurityPayload, devrel: DevRelPayload, leadership: LeadershipPayload };
    for (const id of TEAM_IDS) {
      const p = schemas[id].parse(await dash(id));
      expect(p.team, id).toBe(id);
      expect(p.kpis.length, id).toBeGreaterThanOrEqual(4);
      expect(p.people.length, id).toBeGreaterThanOrEqual(3);
      expect(p.people.length, id).toBeLessThanOrEqual(5);
      expect(p.angle.facts.length, id).toBeGreaterThanOrEqual(1);
      expect(p.angle.facts.length, id).toBeLessThanOrEqual(3);
      expect(p.angle.changes.length, id).toBeGreaterThan(0);
    }
  });

  t("the ripple angle matches the v1 story: Legal, Security and DevRel are hit but not told", async () => {
    for (const id of ["legal", "security", "devrel"] as const) {
      const a = TeamDashboard.parse(await dash(id)).angle;
      expect(a, id).toMatchObject({ affected: true, involved: false, acked: false });
    }
    for (const id of ["eng", "support", "sales"] as const)
      expect(TeamDashboard.parse(await dash(id)).angle, id).toMatchObject({ affected: true, involved: true });
  });

  t("leadership is affected: its goal is BLOCKED_BY the decision", async () => {
    const a = TeamDashboard.parse(await dash("leadership")).angle;
    expect(a).toMatchObject({ decisionId: "d-1", affected: true });
    expect(a.facts.map((f) => f.text).join(" ")).toContain("is blocked by");
  });

  t("changes stay inside the decision's ripple and read as sentences", async () => {
    const a = TeamDashboard.parse(await dash("support")).angle;
    expect(a.changes.length).toBeGreaterThan(0);
    const now = Math.floor(Date.parse("2026-10-17T09:00:00Z") / 1000);
    const inside = new Set([...(await (await import("@/lib/graph/queries")).ripple(g, "d-1", now)).nodes.map((n) => n.id), "d-1"]);
    for (const c of a.changes) {
      const e = `${c.edge.from} ${c.edge.type} ${c.edge.to}`;
      expect([c.edge.from, c.edge.to].includes("d-1") || (inside.has(c.edge.from) && inside.has(c.edge.to)), e).toBe(true);
      expect(describeEdge(c.edge, (id) => id), e).not.toMatch(/[A-Z]{3,}/);
    }
    expect(a.changes.some((c) => ["mobile-app", "web-app"].includes(c.edge.to))).toBe(false);
  });

  t("eng: ~30 PRs incl. the v1 ones, a couple merged without review, incidents and on-call", async () => {
    const p = EngPayload.parse(await dash("eng"));
    expect(p.prs.length).toBeGreaterThanOrEqual(30);
    expect(p.prs.filter((x) => x.id.startsWith("pr-v1-"))).toHaveLength(9);
    expect(p.prs.filter((x) => x.state === "merged" && x.firstReviewAt === null).length).toBeGreaterThanOrEqual(2);
    expect(p.incidents.length).toBeGreaterThanOrEqual(4);
    expect(p.services.map((x) => x.id)).toEqual(expect.arrayContaining(["web-app", "mobile-app", "ledger-db", "billing", "auth-service", "api-v1", "api-v2", "sdk-js", "sdk-py"]));
    expect(p.services.find((x) => x.id === "api-v1")?.onCallPersonId).toBe("p-priya");
  });

  t("support: 12 open v1 tickets plus a real queue, spread across people", async () => {
    const p = SupportPayload.parse(await dash("support"));
    expect(p.tickets.filter((x) => x.v1Related && x.status === "open")).toHaveLength(12);
    expect(p.tickets.length).toBeGreaterThanOrEqual(37);
    expect(new Set(p.tickets.map((x) => x.assigneeId)).size).toBeGreaterThanOrEqual(4);
    expect(p.tickets.some((x) => x.firstResponseAt === null)).toBe(true);
    expect(p.customers.every((c) => c.healthScore >= 0 && c.healthScore <= 100)).toBe(true);
  });

  t("sales: 3 open v1 deals among ~15, with the quarter goal", async () => {
    const p = SalesPayload.parse(await dash("sales"));
    expect(p.deals.filter((d) => d.v1Related && d.stage !== "closed_lost")).toHaveLength(3);
    expect(p.deals.length).toBeGreaterThanOrEqual(15);
    expect(new Set(p.deals.map((d) => d.stage)).size).toBe(6);
    expect(p.goals).toHaveLength(1);
    expect(p.goals[0].target).toBeGreaterThan(0);
  });

  t("legal: 8 contracts and clause 7.2 (high risk) for both guaranteeing contracts", async () => {
    const p = LegalPayload.parse(await dash("legal"));
    expect(p.contracts).toHaveLength(8);
    const g72 = p.clauses.filter((c) => c.number === "7.2");
    expect(g72.map((c) => c.contractId).sort()).toEqual(["ctr-1", "ctr-2"]);
    expect(g72.every((c) => c.risk === "high" && c.src.quote.includes("API v1"))).toBe(true);
    expect(p.clauses.some((c) => c.dueAt !== null)).toBe(true);
  });

  t("security: failing audit-blocking controls and the v1 API keys finding on api-v1", async () => {
    const p = SecurityPayload.parse(await dash("security"));
    expect(p.frameworks.map((f) => f.id).sort()).toEqual(["fw-iso27001", "fw-soc2"]);
    expect(p.controls.some((c) => c.status === "failing" && c.auditBlocking)).toBe(true);
    expect(p.findings.find((f) => f.title === "v1 API keys never rotated")).toMatchObject({ systemId: "api-v1", status: "open" });
    expect(p.vendors.length).toBeGreaterThanOrEqual(5);
    expect(p.risks.length).toBeGreaterThanOrEqual(5);
    expect(p.tasks.map((x) => x.kind).sort()).toEqual(["access_review", "access_review", "questionnaire", "questionnaire"]);
  });

  t("devrel: the /v1/quickstart page is the high-traffic one, with docs stats", async () => {
    const p = DevRelPayload.parse(await dash("devrel"));
    const top = [...p.pages].sort((a, b) => b.views30d - a.views30d)[0];
    expect(top).toMatchObject({ path: "/v1/quickstart", v1Related: true });
    expect(top.feedbackDown).toBeGreaterThan(top.feedbackUp);
    expect(p.docsStats.failedSearches.length).toBeGreaterThan(0);
    expect(p.sdks.map((x) => x.id).sort()).toEqual(["sdk-js", "sdk-py"]);
  });

  t("leadership: goals, one BLOCKED_BY the v1 decision", async () => {
    const p = LeadershipPayload.parse(await dash("leadership"));
    expect(p.goals.length).toBeGreaterThanOrEqual(6);
    expect(p.blockers).toContainEqual(expect.objectContaining({ fromId: "goal-2", toId: "d-1" }));
    expect(p.risks.some((r) => r.v1Related)).toBe(true);
  });
});

describe("GET /api/overview", () => {
  t("returns KPIs, open decisions, blockers, changes, a 14-day activity series, who knows and the team strip", async () => {
    const { GET } = await import("./overview/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const o = s.Overview.parse(await res.json());
    expect(o.kpis.find((k) => k.id === "arr-at-risk")?.value).toBe(180_000);
    expect(o.openDecisions).toHaveLength(1);
    expect(o.openDecisions[0].notTold.sort()).toEqual(["devrel", "legal", "security"]);
    expect(o.blockers.length).toBeGreaterThanOrEqual(3);
    expect(o.recentChanges.length).toBeGreaterThan(0);
    expect(o.activity).toHaveLength(14);
    expect(o.activity.some((d) => d.changes > 0)).toBe(true);
    expect(o.activity.some((d) => d.acks > 0)).toBe(true);
    expect(o.whoKnows[0].personId).toBe("p-priya");
    expect(o.teams.map((x) => x.teamId)).toEqual([...TEAM_IDS]);
    expect(o.teams.filter((x) => x.affected && !x.told).map((x) => x.teamId).sort()).toEqual(["devrel", "legal", "security"]);
  });
});
