import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeClient, graphFor, query, type Graph } from "./client";
import { seed } from "../ingest/seed";

const name = `test_seed_${randomUUID().replaceAll("-", "")}`;
let g: Graph | undefined;
let up = false;

// Skip (with a message) when no FalkorDB is reachable; never fail the suite for that.
beforeAll(async () => {
  try {
    g = await graphFor(name);
    await query(g, "RETURN 1");
    up = true;
    await seed(name);
  } catch (e) {
    console.warn(`SKIPPING seed tests: FalkorDB unreachable (${String(e)})`);
  }
}, 30_000);

afterAll(async () => {
  try {
    if (up && g) await g.delete();
  } finally {
    await closeClient();
  }
});

const num = async (cypher: string) =>
  Number((await query<{ n: number }>(g!, cypher))[0].n);
const ids = async (cypher: string) =>
  (await query<{ id: string }>(g!, cypher)).map((r) => r.id).sort();

describe("ledgerly seed", () => {
  const t = (title: string, fn: () => Promise<void>) =>
    it(title, async (ctx) => {
      if (!up) ctx.skip();
      await fn();
    });

  t("40 customers USES api-v1", async () => {
    expect(await num("MATCH (:Customer)-[r:USES]->(:System {id:'api-v1'}) WHERE r.valid_to IS NULL RETURN count(r) AS n")).toBe(40);
  });
  t("12 open tickets ABOUT api-v1", async () => {
    expect(await num("MATCH (a:Ticket {status:'open'})-[r:ABOUT]->(:System {id:'api-v1'}) WHERE r.valid_to IS NULL RETURN count(a) AS n")).toBe(12);
  });
  t("3 open deals PROMISED api-v1", async () => {
    expect(await num("MATCH (d:Deal)-[r:PROMISED]->(:System {id:'api-v1'}) WHERE r.valid_to IS NULL AND d.stage <> 'closed_lost' RETURN count(d) AS n")).toBe(3);
  });
  t("2 contracts GUARANTEES past the sunset date; $180k ARR at risk", async () => {
    const cypher = `MATCH (:Decision)-[s:SUNSETS]->(:System {id:'api-v1'})<-[g:GUARANTEES]-(c:Contract)-[:PARTY_TO]->(cu:Customer)
      WHERE s.valid_to IS NULL AND g.valid_to IS NULL AND g.until > s.on`;
    expect(await num(`${cypher} RETURN count(c) AS n`)).toBe(2);
    expect(await num(`${cypher} RETURN sum(cu.arr) AS n`)).toBe(180_000);
  });
  t("gap teams are Legal, Security, DevRel", async () => {
    expect(await ids(`MATCH (t:Team)-[:AFFECTED]->(:System {id:'api-v1'})
      WHERE NOT (t)-[:INVOLVED_IN]->(:Decision {id:'d-1'}) RETURN t.id AS id`)).toEqual(["devrel", "legal", "security"]);
    expect(await ids("MATCH (t:Team)-[:INVOLVED_IN]->(:Decision {id:'d-1'}) RETURN t.id AS id")).toEqual(["eng", "sales", "support"]);
  });
  t("decoys are not returned by a current-edges query", async () => {
    const got = await ids(`MATCH (x)-[r:USES|ABOUT|PROMISED|GUARANTEES]->(:System {id:'api-v1'})
      WHERE r.valid_to IS NULL RETURN x.id AS id`);
    for (const d of ["art-tkt-closed", "art-tkt-invoice", "deal-lost", "cust-41", "art-msg-lost"]) expect(got).not.toContain(d);
    expect(got).toHaveLength(40 + 12 + 3 + 2 + 9);
  });
  t("v2 data: people, tickets, PRs, deals, contracts and the new labels", async () => {
    expect(await num("MATCH (p:Person) RETURN count(p) AS n")).toBe(31);
    expect(await num("MATCH (t:Ticket) RETURN count(t) AS n")).toBe(39);
    expect(await num("MATCH (t:Ticket) WHERE t.priority IS NULL RETURN count(t) AS n")).toBe(0);
    expect(await num("MATCH (p:PR) WHERE p.state IS NOT NULL RETURN count(p) AS n")).toBe(31);
    expect(await num("MATCH (d:Deal) RETURN count(d) AS n")).toBe(16);
    expect(await num("MATCH (c:Contract) RETURN count(c) AS n")).toBe(8);
    expect(await num("MATCH (i:Incident) RETURN count(i) AS n")).toBe(6);
    expect(await num("MATCH (:Contract)-[:HAS_CLAUSE]->(k:Clause) RETURN count(k) AS n")).toBe(13);
    expect(await num("MATCH (:Control)-[:COVERS]->(:Framework) RETURN count(*) AS n")).toBe(14);
    expect(await num("MATCH (:Goal)-[:BLOCKED_BY]->(:Decision {id:'d-1'}) RETURN count(*) AS n")).toBe(1);
    expect(await num("MATCH (f:Finding {title:'v1 API keys never rotated'})-[:FOUND_IN]->(:System {id:'api-v1'}) RETURN count(f) AS n")).toBe(1);
    expect(await num("MATCH (p:Page {path:'/v1/quickstart'}) WHERE p.views30d > 40000 RETURN count(p) AS n")).toBe(1);
    expect(await num("MATCH (c:Customer) WHERE c.healthScore IS NULL OR c.renewalDate IS NULL RETURN count(c) AS n")).toBe(0);
  });
  t("every relationship has valid_from and observed_at", async () => {
    expect(await num("MATCH ()-[r]->() WHERE r.valid_from IS NULL OR r.observed_at IS NULL RETURN count(r) AS n")).toBe(0);
  });
  t("running seed twice leaves counts unchanged", async () => {
    const count = async () => [
      await num("MATCH (n) RETURN count(n) AS n"),
      await num("MATCH ()-[r]->() RETURN count(r) AS n"),
    ];
    const before = await count();
    await seed(name);
    expect(await count()).toEqual(before);
  });
});
