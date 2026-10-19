// #212: graph algorithms as tools (algo.pageRank, algo.WCC, algo.SPpaths on FalkorDB 6.0.2), bounded `limit` on list tools, edge weights.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeClient, graphFor, query, type Graph } from "../graph/client";
import { seed } from "../ingest/seed";
import { applyProposal } from "../connectors/apply";
import { DEFAULT_LIMIT, MAX_LIMIT, READ_TOOLS, TOOLS, type Ctx } from "./tools";

const name = `test_algo_${randomUUID().replaceAll("-", "")}`;
const NOW = Math.floor(Date.parse("2026-10-17T09:00:00Z") / 1000);
let g: Graph;
let up = false;
const ctx = (): Ctx => ({ g, now: NOW, demo: true });

beforeAll(async () => {
  try {
    await seed(name);
    g = await graphFor(name);
    up = true;
  } catch (e) {
    console.warn(`SKIPPING algorithm tests: FalkorDB unreachable (${String(e)})`);
  }
}, 60_000);
afterAll(async () => {
  try {
    if (up) await g.delete();
  } finally {
    await closeClient();
  }
});
const t = (title: string, fn: () => Promise<void>) =>
  it(title, async (c) => {
    if (!up) c.skip();
    await fn();
  });
const num = async (cypher: string) => (await query<{ n: number }>(g, cypher))[0].n;

describe("critical_systems", () => {
  t("ranks api-v1 first and auth-service in the top 5 on the seeded graph", async () => {
    const { rows } = await TOOLS.critical_systems.run(ctx(), { limit: 5 });
    const ids = rows.map((r) => r.systemId);
    expect(ids[0]).toBe("api-v1");
    expect(ids.slice(0, 5)).toContain("auth-service");
    expect(rows.length).toBeLessThanOrEqual(5);
  });
});

describe("team_clusters", () => {
  t("groups Legal with Sales (contracts and deals on api-v1) and returns only counts of restricted nodes", async () => {
    const { rows } = await TOOLS.team_clusters.run(ctx(), {});
    const c = rows.find((r) => (r.teamIds as string[]).includes("legal"));
    expect(c?.teamIds).toEqual(expect.arrayContaining(["legal", "sales"]));
    expect(c?.systemIds).toContain("api-v1");
    expect(typeof c?.contracts).toBe("number");
    expect(JSON.stringify(rows)).not.toMatch(/ctr-|deal-/);
  });
});

describe("weighted_path", () => {
  t("equals the shortest path while every weight is 1, and follows weight when it differs", async () => {
    const w = (await TOOLS.weighted_path.run(ctx(), { decisionId: "d-1", teamId: "legal" })).rows[0] as { found: boolean; weight: number; hops: number; nodes: { id: string }[] };
    expect(w.found).toBe(true);
    expect(w.weight).toBe(w.hops);
    expect(w.nodes[0].id).toBe("d-1");
    expect(w.nodes.at(-1)?.id).toBe("legal");
    // make every GUARANTEES edge expensive: the route (or its cost) must change
    await query(g, "MATCH ()-[r:GUARANTEES]->() SET r.weight = 50");
    const heavy = (await TOOLS.weighted_path.run(ctx(), { decisionId: "d-1", teamId: "legal" })).rows[0] as { weight: number };
    expect(heavy.weight).toBeGreaterThan(w.weight);
    await query(g, "MATCH ()-[r:GUARANTEES]->() SET r.weight = 1");
  });
  t("unknown decision and unreachable team answer honestly", async () => {
    expect((await TOOLS.weighted_path.run(ctx(), { decisionId: "d-404", teamId: "legal" })).rows[0]).toMatchObject({ found: false });
    expect((await TOOLS.weighted_path.run(ctx(), { decisionId: "d-1", teamId: "no-such-team" })).rows[0]).toMatchObject({ found: false });
  });
});

describe("edge weights", () => {
  t("the seed sets weight 1 on DEPENDS_ON, USES, OWNS, GUARANTEES and PROMISED", async () => {
    expect(await num("MATCH ()-[r:DEPENDS_ON|USES|OWNS|GUARANTEES|PROMISED]->() WHERE r.weight IS NULL RETURN count(r) AS n")).toBe(0);
    expect(await num("MATCH ()-[r:USES]->() WHERE r.weight = 1 RETURN count(r) AS n")).toBeGreaterThan(0);
  });
  t("a connector proposal gets weight 1 by default and may set its own", async () => {
    const edge = (type: string, props: object) => ({ op: "merge_edge", type, from: { label: "System", id: "web-app" }, to: { label: "System", id: "ledger-db" }, props, src: "art-rfc14", confidence: 1, structured: true });
    await applyProposal(g, edge("DEPENDS_ON", {}), NOW);
    expect(await num("MATCH (:System {id:'web-app'})-[r:DEPENDS_ON]->(:System {id:'ledger-db'}) RETURN r.weight AS n")).toBe(1);
    await applyProposal(g, edge("DEPENDS_ON", { weight: 4 }), NOW);
    expect(await num("MATCH (:System {id:'web-app'})-[r:DEPENDS_ON]->(:System {id:'ledger-db'}) RETURN r.weight AS n")).toBe(4);
  });
});

describe("bounded limits", () => {
  // Tools whose output is one record, a fixed small set, or a write: no list to bound. A new read tool must be added to one of the two lists.
  // recall caps its own limit at 5 (#210)
  const EXEMPT = ["ripple", "trace_decision", "bottleneck", "why_affected", "weighted_path", "edge_freshness", "contract_conflicts", "decision_costs", "list_decisions", "list_agents", "run_agent", "recall", "campaign_preview", "campaign_status"];
  const LISTS = ["search", "who_knows", "customer_usage", "deals_at_risk", "critical_systems", "team_clusters", "affected_tickets", "docs_pages", "contract_renewals", "contract_clauses", "access_gap", "affected_controls"];

  it("every list-returning read tool caps `limit` at 20 in its zod input", () => {
    expect([...LISTS, ...EXEMPT].sort()).toEqual([...READ_TOOLS].sort());
    for (const n of LISTS) {
      const input = TOOLS[n as keyof typeof TOOLS].input;
      expect(input.safeParse({ ...sample(n), limit: MAX_LIMIT }).success, `${n} accepts ${MAX_LIMIT}`).toBe(true);
      expect(input.safeParse({ ...sample(n), limit: MAX_LIMIT + 1 }).success, `${n} rejects ${MAX_LIMIT + 1}`).toBe(false);
      expect(input.safeParse({ ...sample(n), limit: 0 }).success, `${n} rejects 0`).toBe(false);
      expect(input.safeParse(sample(n)).success, `${n} limit is optional`).toBe(true);
    }
    expect(DEFAULT_LIMIT).toBe(10);
  });

  t("the Cypher enforces it (LIMIT $limit), not just the schema", async () => {
    expect((await TOOLS.customer_usage.run(ctx(), { decisionId: "d-1", limit: 2 })).rows).toHaveLength(2);
    expect((await TOOLS.customer_usage.run(ctx(), { decisionId: "d-1" })).rows.length).toBeLessThanOrEqual(DEFAULT_LIMIT);
    expect((await TOOLS.deals_at_risk.run(ctx(), { decisionId: "d-1", limit: 1 })).rows).toHaveLength(1);
    expect((await TOOLS.who_knows.run(ctx(), { systemId: "api-v1", limit: 1 })).rows).toHaveLength(1);
    expect((await TOOLS.search.run(ctx(), { text: "sunset", limit: 1 })).rows).toHaveLength(1);
    expect((await TOOLS.contract_clauses.run(ctx(), { contractId: "ctr-1", limit: 2 })).rows).toHaveLength(2);
  });
});

function sample(n: string): Record<string, unknown> {
  const a: Record<string, Record<string, unknown>> = {
    search: { text: "x" }, who_knows: { systemId: "api-v1" }, contract_renewals: { withinDays: 30 }, contract_clauses: { contractId: "ctr-1" },
  };
  return a[n] ?? (["critical_systems", "team_clusters"].includes(n) ? {} : { decisionId: "d-1" });
}

describe("parallel edges", () => {
  // FalkorDB 6.0.2 treats a relationship that the query never references as an existence check: two parallel edges give one row.
  // A pattern that needs one row per edge must return a property of (or the id of) the relationship, as customer-usage.cypher does with `u`.
  t("customer_usage lists each parallel USES edge (it references u), and a duplicate PARTY_TO does not double a customer's ARR", async () => {
    const before = (await TOOLS.customer_usage.run(ctx(), { decisionId: "d-1", limit: MAX_LIMIT })).rows.filter((r) => r.customerId === "cust-1").length;
    await query(g, "MATCH (c:Customer {id: 'cust-1'}), (s:System {id: 'api-v1'}) CREATE (c)-[:USES {calls_30d: 7, last_seen: $now, valid_from: $now, valid_to: null, weight: 1}]->(s)", { now: NOW });
    const after = (await TOOLS.customer_usage.run(ctx(), { decisionId: "d-1", limit: MAX_LIMIT })).rows.filter((r) => r.customerId === "cust-1");
    expect(after).toHaveLength(before + 1);
    expect(after.map((r) => r.calls30d)).toContain(7);

    const arr = await num("MATCH (:Contract {id: 'ctr-1'})-[:PARTY_TO]->(cu:Customer) RETURN sum(cu.arr) AS n");
    await query(g, "MATCH (c:Contract {id: 'ctr-1'})-[:PARTY_TO]->(cu:Customer) CREATE (c)-[:PARTY_TO {valid_from: $now}]->(cu)", { now: NOW });
    expect(await num("MATCH (:Contract {id: 'ctr-1'})-[:PARTY_TO]->(cu:Customer) RETURN sum(cu.arr) AS n")).toBe(arr);
  });
});
