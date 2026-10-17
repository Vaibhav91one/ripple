import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeClient, graphFor, query, type Graph } from "../graph/client";
import { ensureSchema } from "../graph/schema";
import { findClauses } from "./contract";
import { MAX_BYTES, parseFile } from "./parse";
import { uploadFile } from "./upload";

vi.mock("server-only", () => ({}));
const fx = (n: string) => readFileSync(`lib/ingest/fixtures/${n}`);

describe("parseFile", () => {
  it("reads a PDF with page numbers", async () => {
    const p = await parseFile("two-page.pdf", fx("two-page.pdf"));
    expect(p.pages).toHaveLength(2);
    expect(p.pages![0]).toContain("API v1 is retired on 2027-01-31");
    expect(p.text).toContain("[Page 2]\nMigration");
  });
  it("reads a DOCX as paragraphs", async () => {
    const p = await parseFile("memo.docx", fx("memo.docx"));
    expect(p.paragraphs).toEqual(["Launch checklist", "Ship the new billing page by Friday.", "Ana owns the rollout."]);
  });
  it("reads markdown as-is", async () => expect((await parseFile("rfc.md", fx("rfc.md"))).text).toContain("sunset API v1 on 2027-01-31"));
  it("rejects a wrong type, a fake PDF and an oversize file", async () => {
    await expect(parseFile("x.exe", Buffer.from("MZ"))).rejects.toThrow(/not supported/);
    await expect(parseFile("x.pdf", Buffer.from("hello"))).rejects.toThrow(/not a PDF/);
    await expect(parseFile("big.txt", Buffer.alloc(MAX_BYTES + 1, 97))).rejects.toThrow(/20MB limit/);
  });
});

describe("contracts", () => {
  it("finds numbered clauses and skips bare headings", async () => {
    const { text } = await parseFile("contract.pdf", fx("contract.pdf"));
    const c = findClauses(text);
    expect(c.map((x) => x.number)).toEqual(["1.1", "7.2", "9.1", "11.1"]);
    expect(c[1]).toMatchObject({ title: "API v1 availability", text: expect.stringContaining("until 2027-06-30") });
  });

  describe("graph (FalkorDB)", () => {
    let g: Graph;
    const name = `test_upload_${randomUUID().replaceAll("-", "")}`;
    const env = () => ({ org: { id: "o", graphName: name, isDemo: false }, writer: () => g, now: 1_800_000_000 });
    beforeAll(async () => {
      g = await graphFor(name);
      await ensureSchema(g);
      await query(g, "CREATE (:Customer {id: 'cust-1', name: 'Northwind'})");
    }, 30_000);
    afterAll(async () => { await g?.delete().catch(() => {}); await closeClient(); });

    it("creates Contract + Clause nodes, linked to the customer, and is idempotent", async () => {
      const submit = vi.fn(async () => ({ duplicate: false }));
      const run = () => uploadFile({ name: "contract.pdf", buf: fx("contract.pdf") }, "contract", { customerId: "cust-1", expires: "2027-06-30" }, env(), submit);
      expect(await run()).toMatchObject({ ok: true, pages: 2, clauses: 4, linked: true });
      await run();
      const n = async (q: string) => (await query<{ n: number }>(g, q))[0].n;
      expect(await n("MATCH (:Contract)-[:HAS_CLAUSE]->(k:Clause) RETURN count(k) AS n")).toBe(4);
      expect(await n("MATCH (:Customer {id:'cust-1'})<-[:PARTY_TO]-(c:Contract) WHERE c.endsAt = 1814313600 RETURN count(c) AS n")).toBe(1);
      expect(submit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ source: "doc", title: "contract" }));
    });

    it.skipIf(!process.env.DATABASE_URL)("stores the text once (sha256 dedupe, Postgres)", async () => {
      const { db } = await import("../db");
      const { orgs } = await import("../db/schema");
      const { eq } = await import("drizzle-orm");
      const { storeDocument } = await import("./pipeline");
      const org = { id: `test-up-${randomUUID()}`, graphName: name, isDemo: false };
      await db().insert(orgs).values({ id: org.id, slug: org.id, graphName: name });
      try {
        const run = () => uploadFile({ name: "rfc.md", buf: fx("rfc.md") }, "rfc", {}, { ...env(), org }, (o, input) => storeDocument({ org: o }, input));
        expect(await run()).toMatchObject({ ok: true, duplicate: false });
        expect(await run()).toMatchObject({ ok: true, duplicate: true });
      } finally {
        await db().delete(orgs).where(eq(orgs.id, org.id));
      }
    });

    it("reports a file error without throwing", async () => {
      const r = await uploadFile({ name: "a.exe", buf: Buffer.from("x") }, "document", {}, env());
      expect(r).toMatchObject({ ok: false, error: expect.stringContaining("not supported") });
    });
  });
});
