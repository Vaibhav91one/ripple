import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeClient, graphFor, query, type Graph } from "./client";
import { seed } from "../ingest/seed";
import { bottleneck, changeSunset, conflicts, diff, gap, ripple, search, searchVector, whoKnows } from "./queries";

const name = `test_q_${randomUUID().replaceAll("-", "")}`;
const day = (d: string) => Math.floor(Date.parse(`${d}T09:00:00Z`) / 1000);
const NOW = day("2026-10-17");
let g: Graph;
let up = false;
let hasEmb = false;

beforeAll(async () => {
  try {
    g = await graphFor(name);
    await query(g, "RETURN 1");
    up = true;
    await seed(name);
    hasEmb = ((await query<{ n: number }>(g, "MATCH (a:Artifact) WHERE a.emb IS NOT NULL RETURN count(a) AS n"))[0].n ?? 0) > 0;
  } catch (e) {
    console.warn(`SKIPPING query tests: FalkorDB unreachable (${String(e)})`);
  }
}, 30_000);

afterAll(async () => {
  try {
    if (up) await g.delete();
  } finally {
    await closeClient();
  }
});

const t = (title: string, fn: () => Promise<void>, need = true) =>
  it(title, async (ctx) => {
    if (!up || !need) ctx.skip();
    await fn();
  });

describe("queries on the ledgerly seed (in order: later tests mutate the graph)", () => {
  t("ripple counts match the seed", async () => {
    const r = await ripple(g, "d-1", NOW);
    expect(r.teams.map((x) => x.teamId).sort()).toEqual(["devrel", "legal", "sales", "security", "support"]);
    expect(r.gap.sort()).toEqual(["devrel", "legal", "security"]);
    expect(r.counts).toMatchObject({
      teamsAffected: 5, notTold: 3, conflicts: 1, customers: 40, tickets: 12, deals: 3, contracts: 2, arrAtRisk: 180_000,
    });
    expect(r.teams.every((x) => x.why.length > 0 && x.why.every((w) => w.source.quote))).toBe(true);
    expect(r.cypher.map((c) => c.name)).toContain("ripple");
    expect(r.cypher.every((c) => c.text.length > 0)).toBe(true);
  });

  t("ripple excludes decoys and walks DEPENDS_ON", async () => {
    const r = await ripple(g, "d-1", NOW);
    const ids = r.nodes.map((x) => x.id);
    for (const d of ["art-tkt-closed", "art-tkt-invoice", "deal-lost", "cust-41", "art-msg-lost", "eng"]) expect(ids).not.toContain(d);
    expect(r.nodes.find((x) => x.id === "auth-service")?.hop).toBe(2);
    expect(r.nodes.find((x) => x.id === "api-v1")?.hop).toBe(1);
  });

  t("exactly one open conflict, idempotent", async () => {
    const a = await conflicts(g, "d-1", NOW);
    const b = await conflicts(g, "d-1", NOW + 60);
    expect(a.data.filter((c) => c.status === "open")).toHaveLength(1);
    expect(b.data).toHaveLength(1);
    expect(b.data[0]).toMatchObject({ severity: "high", status: "open", contractIds: ["ctr-1", "ctr-2"] });
    expect(b.data[0].detectedAt).toBe(NOW);
    expect(b.data[0].sources.length).toBeGreaterThan(1);
  });

  t("whoKnows(api-v1) puts Priya first", async () => {
    const { data } = await whoKnows(g, "api-v1");
    expect(data[0].personId).toBe("p-priya");
    expect(data[0]).toMatchObject({ authored: 10, reviewed: 0 });
    expect(data.length).toBeLessThanOrEqual(5);
    expect(data.map((x) => x.personId)).toContain("p-ana");
    expect(data.find((x) => x.personId === "p-ana")?.handled).toBe(12);
    expect(data[0].evidence).toContain("pr-v1-1");
  });

  t("bottleneck groups open WAITING_ON by blocker", async () => {
    const { data } = await bottleneck(g, NOW);
    expect(data.map((r) => r.blockerTeamId)).toEqual(["legal", "security", "eng"]);
    expect(data[0]).toMatchObject({ openRequests: 4, totalWaitDays: 38, oldestDays: 17 });
    expect(data[0].waitingTeamIds).toEqual(["eng", "finance", "product", "sales"]);
  });

  t("full-text search finds artifacts", async () => {
    const { data } = await search(g, "sunset");
    expect(data.length).toBeGreaterThan(0);
  });

  t("vector search (needs embeddings from #14)", async () => {
    const dim = 384;
    const { data } = await searchVector(g, Array.from({ length: dim }, () => 0.1), 3);
    expect(data.length).toBeGreaterThan(0);
  }, hasEmb);

  t("gap shrinks after Legal acks", async () => {
    const before = await gap(g, "d-1", ["support", "sales", "legal", "security", "devrel"]);
    expect(before.data.sort()).toEqual(["devrel", "legal", "security"]);
    await query(g, "MATCH (t:Team {id:'legal'}), (d:Decision {id:'d-1'}) MERGE (t)-[r:ACKED]->(d) SET r.valid_from = $now, r.observed_at = $now", { now: NOW });
    const after = await gap(g, "d-1", ["support", "sales", "legal", "security", "devrel"]);
    expect(after.data.sort()).toEqual(["devrel", "security"]);
  });

  t("moving the sunset to Jul 15 resolves the conflict; diff shows both SUNSETS edges", async () => {
    const since = NOW - 86400;
    const r = await changeSunset(g, "d-1", day("2027-07-15"), NOW);
    expect(r.data).toHaveLength(1);
    expect(r.data[0].status).toBe("resolved");
    const rip = await ripple(g, "d-1", NOW);
    expect(rip.counts.conflicts).toBe(0);
    expect(rip.counts.arrAtRisk).toBe(0);
    const { data } = await diff(g, since);
    const sunsets = data.filter((c) => c.edge.type === "SUNSETS");
    expect(sunsets.map((c) => c.kind).sort()).toEqual(["added", "ended"]);
    expect(sunsets.every((c) => c.at === NOW)).toBe(true);
  });
});
