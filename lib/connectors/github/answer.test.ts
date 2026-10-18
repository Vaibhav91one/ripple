import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Graph } from "../../graph/client";

vi.mock("server-only", () => ({}));
const asked: { text: string; params: Record<string, unknown> }[] = [];
vi.mock("../../graph/client", () => ({
  graphFor: vi.fn(),
  roQuery: async (_g: unknown, text: string, params: Record<string, unknown> = {}) => {
    asked.push({ text, params });
    if (text.includes("STARTS WITH $paths RETURN s.id")) return [{ id: "gh:acme/shop", name: "acme/shop", path: null }];
    if (text.includes("OWNED_BY")) return [{ name: "Platform" }];
    if (text.includes("SUNSETS")) return [{ id: "d-1", title: "Sunset v1 for Initech" }];
    return [];
  },
}));

const g = {} as Graph;
const files = { request: async () => ({ data: [{ filename: "a.ts" }] }) };
beforeEach(() => { asked.length = 0; });

describe("public repos never leak a decision", () => {
  it("the Check Run on a public repo (incl. outside forks) shows systems and teams, no decision query at all", async () => {
    const { pathImpact } = await import("./answer");
    const i = await pathImpact(g, files, { repo: "acme/shop", number: 3, publicRepo: true });
    expect(i.teams).toEqual(["Platform"]);
    expect(i.decisionTitle).toBeUndefined();
    expect(asked.some((q) => q.text.includes("SUNSETS"))).toBe(false);
  });
  it("a private repo's check may name the change", async () => {
    const { pathImpact } = await import("./answer");
    expect((await pathImpact(g, files, { repo: "acme/shop", number: 3, publicRepo: false })).decisionTitle).toBe("Sunset v1 for Initech");
  });
  it("public mention facts only follow a decision that sunsets this repo's own system", async () => {
    const { repoFacts } = await import("./answer");
    await repoFacts(g, { repo: "acme/shop" });
    const q = asked.find((x) => x.text.includes("SUNSETS"))!;
    expect(q.text).toContain("t.id = $repo OR t.id STARTS WITH $paths");
    expect(q.params).toMatchObject({ repo: "gh:acme/shop", paths: "gh:acme/shop:" });
  });
});
