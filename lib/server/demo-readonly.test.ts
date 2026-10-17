// The public demo: the lens cookie sets viewer.teamIds, and every write is a 403 demo_readonly for anonymous viewers.
// Nothing here writes: each call is refused before the graph is touched.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeClient, graphFor, query } from "../graph/client";
import { parseLens } from "../lens";
import { TOOLS } from "../agent/tools";

let lens: string | undefined;
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (k: string) => (k === "ripple_lens" && lens ? { value: lens } : undefined) }) }));

let up = false;
beforeAll(async () => {
  delete process.env.RIPPLE_GRAPH; // the real demo org, so the lock is on
  try {
    await query(await graphFor("demo"), "RETURN 1");
    up = true;
  } catch (e) {
    console.warn(`SKIPPING demo-readonly route tests: FalkorDB unreachable (${String(e)})`);
  }
});
afterAll(closeClient);
beforeEach(() => { lens = undefined; });

const t = (title: string, fn: () => Promise<void>) => it(title, async (c) => { if (!up) c.skip(); await fn(); });
const post = (body: unknown) => new Request("http://t/x", { method: "POST", body: JSON.stringify(body) });

describe("lens", () => {
  it("parseLens falls back to change-owner for anything off the allowlist", () => {
    expect(parseLens("legal")).toBe("legal");
    for (const bad of [undefined, "", "admin", "LEGAL", "eng"]) expect(parseLens(bad)).toBe("change-owner");
  });

  t("the cookie sets viewer.teamIds; an invalid one is the change owner (eng)", async () => {
    const { getContext } = await import("./context");
    for (const [cookie, team] of [["legal", "legal"], ["sales", "sales"], ["security", "security"], ["leadership", "leadership"], ["change-owner", "eng"], ["nope", "eng"], [undefined, "eng"]] as const) {
      lens = cookie;
      const c = await getContext();
      expect(c.viewer).toMatchObject({ kind: "anon", teamIds: [team] });
      expect(c.readonly).toBe(true);
    }
  });
});

describe("anonymous demo viewers cannot write", () => {
  t("POST /api/change -> 403 demo_readonly", async () => {
    const { POST } = await import("@/app/api/change/route");
    const res = await POST(post({ decisionId: "d-1", newOn: 1 }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "demo_readonly" });
  });

  t("POST /api/notify -> 403 demo_readonly", async () => {
    const { POST } = await import("@/app/api/notify/route");
    const res = await POST(post({ decisionId: "d-1" }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "demo_readonly" });
  });

  it("create_tasks (agent) and ack_brief (MCP) refuse", async () => {
    await expect(TOOLS.create_tasks.run({ g: undefined as never, now: 0, demo: true, readonly: true }, { decisionId: "d-1" })).rejects.toThrow("demo_readonly");
    const { createRippleServer } = await import("../mcp/server");
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
    const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");
    const [a, b] = InMemoryTransport.createLinkedPair();
    const audit = vi.fn(async () => {});
    await createRippleServer({ g: undefined as never, now: 0, demo: true, readonly: true }, audit).connect(a);
    const client = new Client({ name: "t", version: "0" });
    await client.connect(b);
    const out = await client.callTool({ name: "ack_brief", arguments: { decisionId: "d-1", teamId: "legal" } });
    expect(out.isError).toBe(true);
    expect(JSON.stringify(out.content)).toContain("demo_readonly");
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ outcome: "deny", resourceId: "ack_brief" }));
  });
});
