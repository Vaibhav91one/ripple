import { randomUUID } from "node:crypto";
import Papa from "papaparse";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeClient, graphFor, query, type Graph } from "../../graph/client";
import { ensureSchema } from "../../graph/schema";
import { ImportBody, importRows } from ".";
import { suggestMapping, type CsvType } from "./map";

vi.mock("server-only", () => ({}));
const emitted = vi.fn(async () => {});
vi.mock("../../events/conflicts", () => ({ emitConflictsFound: emitted }));

const SAMPLES: Record<CsvType, string> = {
  customers: "Company,Website,ARR,Tier,Region\nAcme,acme.com,\"$24,000\",Growth,EU\nGlobex,globex.io,,,\n",
  deals: "Deal,Account,Stage,Value\nAcme renewal,Acme,open,\"$12,000\"\n",
  usage: "customer,system,calls_30d,last_seen\nAcme,api-v1,1200,2026-10-01\nGlobex,api-v1,40,2026-09-20\n",
  access: "email,access group,software\nada@x.com,finance-admins,\nada@x.com,,Figma\n",
  software: "name,required_by\nFigma,design-hub\n",
};

let g: Graph;
const name = `test_csv_${randomUUID().replaceAll("-", "")}`;
const count = async (cypher: string) => (await query<{ n: number }>(g, cypher))[0].n;
const run = (type: CsvType, csv = SAMPLES[type], orgId?: string) => {
  const { data, meta } = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
  return importRows(g, ImportBody.parse({ type, mapping: suggestMapping(type, meta.fields!), uploadId: "u1", rows: data }), 1_800_000_000, orgId);
};

describe("csv import (FalkorDB)", () => {
  beforeAll(async () => {
    g = await graphFor(name);
    await ensureSchema(g);
  }, 30_000);
  afterAll(async () => {
    await g?.delete().catch(() => {});
    await closeClient();
  });

  it("imports a sample of each type and re-import does not duplicate", async () => {
    const snapshot = async () => [
      await count("MATCH (n) WHERE NOT n:Migration RETURN count(n) AS n"),
      await count("MATCH ()-[r]->() RETURN count(r) AS n"),
    ];
    for (const t of Object.keys(SAMPLES) as CsvType[]) expect((await run(t)).errors).toEqual([]);
    const first = await snapshot();
    for (const t of Object.keys(SAMPLES) as CsvType[]) await run(t);
    expect(await snapshot()).toEqual(first);

    expect(await count("MATCH (c:Customer) RETURN count(c) AS n")).toBe(2);
    expect(await count("MATCH (c:Customer {name:'Acme', arr: 24000, tier: 'growth', region: 'EU'}) RETURN count(c) AS n")).toBe(1);
    expect(await count("MATCH (:Customer {name:'Acme'})-[u:USES {calls_30d: 1200}]->(:System {id:'api-v1'}) WHERE u.last_seen > 0 RETURN count(u) AS n")).toBe(1);
    expect(await count("MATCH (:Person {id:'person:ada@x.com'})-[:HAS_ACCESS]->(:AccessGroup) RETURN count(*) AS n")).toBe(1);
    expect(await count("MATCH (:Person)-[:HAS_INSTALLED]->(:Software {name:'Figma'}) RETURN count(*) AS n")).toBe(1);
    expect(await count("MATCH (:System {id:'design-hub'})-[:REQUIRES]->(:Software) RETURN count(*) AS n")).toBe(1);
    expect(await count("MATCH (:Customer {name:'Acme'})-[:HAS_DEAL]->(:Deal {amount: 12000}) RETURN count(*) AS n")).toBe(1);
  });

  it("takes an org id for conflict events; no CSV type writes a guarantee, sunset or contract yet, so nothing is emitted", async () => {
    expect((await run("deals", SAMPLES.deals, "org-1")).errors).toEqual([]);
    expect(emitted).not.toHaveBeenCalled();
  });

  it("reports a bad row with its file row number and still imports the rest", async () => {
    const res = await run("usage", "customer,system,calls_30d,last_seen\nGood Co,api-v2,5,2026-10-01\nBad Co,api-v2,lots,2026-10-01\n,api-v2,3,\n");
    expect(res.applied).toBe(1);
    expect(res.errors).toEqual([
      { row: 3, message: 'Calls "lots" is not a number' },
      { row: 4, message: "Customer is empty" },
    ]);
    expect(await count("MATCH (c:Customer {name:'Bad Co'}) RETURN count(c) AS n")).toBe(0);
  });
});
