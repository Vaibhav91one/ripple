import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeClient, graphFor, query, type Graph } from "../graph/client";
import { seed } from "../ingest/seed";
import { createRippleServer } from "./server";

const name = `test_m_${randomUUID().replaceAll("-", "")}`;
const NOW = Math.floor(Date.parse("2026-10-17T09:00:00Z") / 1000);
let g: Graph;
let up = false;
let client: Client;

beforeAll(async () => {
  try {
    g = await graphFor(name);
    await query(g, "RETURN 1");
    up = true;
    await seed(name);
    const [a, b] = InMemoryTransport.createLinkedPair();
    await createRippleServer({ g, now: NOW, demo: true, viewer: { teamIds: ["legal", "sales", "security", "leadership"] } }).connect(a);
    client = new Client({ name: "test", version: "0" });
    await client.connect(b);
  } catch (e) {
    console.warn(`SKIPPING mcp tests: FalkorDB unreachable (${String(e)})`);
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
const call = async (n: string, args: Record<string, unknown>) => {
  const r = await client.callTool({ name: n, arguments: args });
  return JSON.parse((r.content as { text: string }[])[0].text);
};
const teamIds = (out: { rows: { teamId: string }[] }) => out.rows.map((r) => r.teamId).sort();

describe("ripple MCP server (tests run in order: ack_brief mutates the graph)", () => {
  t("lists every tool; only ack_brief is destructive", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((x) => x.name).sort()).toEqual([
      "ack_brief", "affected_controls", "bottleneck", "check_contract_conflict", "deals_at_risk", "list_agents", "list_decisions",
      "ripple_impact", "run_agent", "search", "trace_decision", "who_knows", "who_wasnt_told", "why_affected",
    ]);
    expect(tools.filter((x) => x.annotations?.destructiveHint).map((x) => x.name)).toEqual(["ack_brief"]);
    expect(tools.filter((x) => x.name !== "ack_brief").every((x) => x.annotations?.readOnlyHint)).toBe(true);
  });

  t("list_agents names the agents; run_agent is read-only and says why when it cannot run", async () => {
    const list = await call("list_agents", {});
    expect(list.rows.map((r: { name: string }) => r.name)).toEqual(expect.arrayContaining(["impact", "contract", "digest"]));
    expect(list.rows.some((r: { name: string }) => r.name === "ask")).toBe(false);
    expect((await call("run_agent", { name: "nope", input: {} })).rows[0]).toMatchObject({ ran: false });
    expect((await call("run_agent", { name: "impact", input: { wrong: 1 } })).rows[0]).toMatchObject({ ran: false, reason: "invalid_input" });
    expect((await client.listTools()).tools.find((x) => x.name === "run_agent")?.annotations?.readOnlyHint).toBe(true);
  });

  t("why_affected d-1 -> legal runs through the contract; unknown team is found:false", async () => {
    const out = await call("why_affected", { decisionId: "d-1", teamId: "legal" });
    expect(out.rows[0].found).toBe(true);
    expect(out.rows[0].nodes.map((n: { id: string }) => n.id)).toEqual(["d-1", "api-v1", "ctr-1", "legal"]);
    expect((await call("why_affected", { decisionId: "d-1", teamId: "nope" })).rows[0].found).toBe(false);
  });

  t("ripple_impact d-1 has the known counts and sources", async () => {
    const out = await call("ripple_impact", { decisionId: "d-1" });
    expect(out.rows[0].counts).toMatchObject({ customers: 40, tickets: 12, deals: 3, contracts: 2, arrAtRisk: 180_000 });
    expect(out.sources.length).toBeGreaterThan(0);
    expect(out.cypher.length).toBeGreaterThan(0);
    expect(out.trace).toMatchObject({ tool: "ripple_impact", rows: 1 });
  });

  t("who_wasnt_told d-1 = devrel, legal, security", async () => {
    const out = await call("who_wasnt_told", { decisionId: "d-1" });
    expect(teamIds(out)).toEqual(["devrel", "legal", "security"]);
    expect(out.sources.length).toBeGreaterThan(0);
  });

  t("conflicts, deals and controls for d-1", async () => {
    const c = await call("check_contract_conflict", { decisionId: "d-1" });
    expect(c.rows[0].contractIds).toHaveLength(2);
    expect(c.sources.length).toBeGreaterThan(0);
    const d = await call("deals_at_risk", { decisionId: "d-1" });
    expect(d.rows).toHaveLength(3);
    expect(d.sources.length).toBeGreaterThan(0);
    expect((await call("affected_controls", { decisionId: "d-1" })).rows.length).toBeGreaterThan(0);
  });

  t("unknown decision is an error result, not a throw", async () => {
    const r = await client.callTool({ name: "who_wasnt_told", arguments: { decisionId: "nope" } });
    expect(r.isError).toBe(true);
  });

  t("ack_brief removes the team from the gap", async () => {
    await call("ack_brief", { decisionId: "d-1", teamId: "legal" });
    expect(teamIds(await call("who_wasnt_told", { decisionId: "d-1" }))).toEqual(["devrel", "security"]);
  });
});
