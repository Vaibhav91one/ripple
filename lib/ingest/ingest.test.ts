import { rmSync } from "node:fs";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { artifacts } from "../mock/ledgerly";
import { embedInput, embedTexts, readEmbedding } from "./embed";
import { CACHE_DIR, extractArtifact, quoteCheck, readCache, sha256, type ExtractedEdge } from "./extract";

const e = (quote: string): ExtractedEdge => ({ from: "a", type: "DEPENDS_ON", to: "b", quote });

describe("quoteCheck", () => {
  const text = "auth-service verifies\n  v1 tokens through the legacy key.";
  it("keeps verbatim quotes and drops invented ones", () => {
    const r = quoteCheck(text, [e("legacy key"), e("uses OAuth 2")]);
    expect(r.kept.map((x) => x.quote)).toEqual(["legacy key"]);
    expect(r.dropped.map((x) => x.quote)).toEqual(["uses OAuth 2"]);
  });
  it("ignores whitespace differences, not word differences", () => {
    expect(quoteCheck(text, [e("verifies v1 tokens")]).kept).toHaveLength(1);
    expect(quoteCheck(text, [e("verifies v2 tokens")]).dropped).toHaveLength(1);
    expect(quoteCheck(text, [e("   ")]).dropped).toHaveLength(1);
  });
});

const mockModel = (json: unknown) =>
  new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(json) }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 1, text: 1, reasoning: undefined },
      },
      warnings: [],
    }),
  });

describe("extractArtifact", () => {
  it("never calls the model on a cache hit", async () => {
    const a = artifacts.find((x) => x.id === "art-rfc14")!;
    expect(readCache(a.text)?.origin).toBe("seeded-from-mock");
    const model = mockModel({ edges: [] });
    const r = await extractArtifact(a, model);
    expect(r?.cached).toBe(true);
    expect(r?.edges.length).toBeGreaterThan(0);
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  it("returns null with no cache and no model", async () => {
    expect(await extractArtifact({ id: "x", title: "t", text: "uncached text one" }, null)).toBeNull();
  });

  it("calls the model on a miss, quote-checks, and caches", async () => {
    const a = { id: "art-fresh", title: "t", text: `Zed owns the billing-engine. ${Math.random()}` };
    const model = mockModel({
      edges: [
        { from: "p-zed", type: "OWNS", to: "billing-engine", quote: "Zed owns the billing-engine" },
        { from: "p-zed", type: "OWNS", to: "ledger", quote: "Zed owns the ledger" },
      ],
    });
    try {
      const r = await extractArtifact(a, model);
      expect(model.doGenerateCalls).toHaveLength(1);
      expect(r).toMatchObject({ cached: false, origin: "model" });
      expect(r?.edges).toHaveLength(1);
      expect(r?.dropped).toHaveLength(1);
      const again = await extractArtifact(a, model);
      expect(again?.cached).toBe(true);
      expect(model.doGenerateCalls).toHaveLength(1);
    } finally {
      rmSync(new URL(`${sha256(a.text)}.json`, CACHE_DIR), { force: true });
    }
  });
});

describe("embeddings", () => {
  it("every artifact has a cached 384-d vector", () => {
    for (const a of artifacts) expect(readEmbedding(a)).toHaveLength(384);
    expect(embedInput(artifacts[0]).split(/\s+/).length).toBeLessThanOrEqual(200);
  });

  it("'login problems' is closer to the auth ticket than to an unrelated artifact", async (ctx) => {
    let q: number[];
    try {
      [q] = await embedTexts(["login problems"]);
    } catch (err) {
      console.warn(`SKIPPING real-model embedding test: model unavailable (${String(err)})`);
      return ctx.skip();
    }
    expect(q).toHaveLength(384);
    const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
    const auth = readEmbedding(artifacts.find((x) => x.id === "art-secreview")!)!;
    const other = readEmbedding(artifacts.find((x) => x.id === "art-tkt-invoice")!)!;
    expect(dot(q, auth)).toBeGreaterThan(dot(q, other));
  }, 120_000);
});

