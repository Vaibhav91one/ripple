import { describe, expect, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { buildBrief } from "./briefs";
import { rippleResult } from "./mock/ledgerly";

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

const real = { artifactId: "art-auth-design", quote: "auth-service verifies v1 tokens" };
const opts = (model: ReturnType<typeof mockModel> | null) => ({ rippleResult, model });

describe("buildBrief", () => {
  it("without a model returns sourced deterministic claims", async () => {
    const b = await buildBrief("security", "d-1", opts(null));
    expect(b.llm).toBe(false);
    expect(b.claims.length).toBeGreaterThan(0);
    expect(b.claims.every((c) => c.sources.length > 0)).toBe(true);
  });

  it("keeps a reworded claim with a real source and drops one with an invented source", async () => {
    const model = mockModel({
      claims: [
        { text: "Security owns the service that verifies v1 tokens.", sources: [real] },
        { text: "Security must rotate every key by Friday.", sources: [{ artifactId: "art-invented", quote: "rotate every key by Friday" }] },
        { text: "No sources at all.", sources: [] },
      ],
    });
    const b = await buildBrief("security", "d-1", opts(model));
    expect(b.llm).toBe(true);
    expect(b.claims.map((c) => c.text)).toEqual(["Security owns the service that verifies v1 tokens."]);
    expect(b.dropped).toBe(2);
  });

  it("falls back to deterministic claims when every model claim is unsourced", async () => {
    const model = mockModel({ claims: [{ text: "Made up.", sources: [{ artifactId: "x", quote: "y" }] }] });
    const b = await buildBrief("security", "d-1", opts(model));
    expect(b.llm).toBe(false);
    expect(b.claims.length).toBeGreaterThan(0);
  });
});
