import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decodeAckToken } from "./ack-token";
import { closeClient, graphFor, query, type Graph } from "./graph/client";
import { ripple } from "./graph/queries";
import { seed } from "./ingest/seed";
import { notifyGaps, recordAck } from "./notify";

const name = `test_b_${randomUUID().replaceAll("-", "")}`;
const NOW = Math.floor(Date.parse("2026-10-17T09:00:00Z") / 1000);
let g: Graph;
let up = false;

beforeAll(async () => {
  try {
    g = await graphFor(name);
    await query(g, "RETURN 1");
    up = true;
    await seed(name);
  } catch (e) {
    console.warn(`SKIPPING notify tests: FalkorDB unreachable (${String(e)})`);
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

describe("notify and ack on a temp graph (in order)", () => {
  t("notify writes Task + NOTIFIES for exactly the 3 gap teams and previews the email", async () => {
    const res = await notifyGaps(g, "d-1", { now: NOW, model: null, env: {}, baseUrl: "http://x" });
    expect(res.map((r) => r.teamId).sort()).toEqual(["devrel", "legal", "security"]);
    expect(res.every((r) => r.email.status === "preview" && r.github.status === "skipped" && r.claims > 0)).toBe(true);
    const rows = await query<{ team: string }>(g, "MATCH (:Task)-[:NOTIFIES]->(tm:Team) RETURN tm.id AS team");
    expect(rows.map((r) => r.team).sort()).toEqual(["devrel", "legal", "security"]);
    const out = await query<{ status: string; html: string }>(g, "MATCH (o:Outbox) RETURN o.status AS status, o.html AS html");
    expect(out).toHaveLength(3);
    expect(out.every((o) => o.status === "preview" && o.html.includes("/ack/"))).toBe(true);
    for (const r of res) expect(decodeAckToken(r.token, NOW).state).toBe("ok");
  });

  t("tasks carry an owner (the team lead), a due date 14 days before the effective date, and the brief's claims", async () => {
    const rows = await query<{ team: string; owner: string; due: number; body: string }>(
      g, "MATCH (k:Task)-[:NOTIFIES]->(tm:Team) RETURN tm.id AS team, k.assigneeId AS owner, k.dueAt AS due, k.body AS body ORDER BY team",
    );
    expect(rows.map((r) => [r.team, r.owner])).toEqual([["devrel", "p-maya"], ["legal", "p-mei"], ["security", "p-tara"]]);
    const eff = (await query<{ on: number }>(g, "MATCH (:Decision {id: 'd-1'})-[s:SUNSETS]->() RETURN s.on AS on"))[0].on;
    for (const r of rows) {
      expect(Number(r.due)).toBe(Number(eff) - 14 * 86400);
      expect(r.body).toContain("(art-");
    }
  });

  t("notify is idempotent", async () => {
    await notifyGaps(g, "d-1", { now: NOW, model: null, env: {}, baseUrl: "http://x" });
    const n = await query<{ n: number }>(g, "MATCH (:Task)-[r:NOTIFIES]->(:Team) RETURN count(r) AS n");
    expect(Number(n[0].n)).toBe(3);
  });

  t("ack removes the team from the gap and writes ACKED {kind, by, at}", async () => {
    const r = await recordAck(g, { teamId: "legal", decisionId: "d-1", kind: "concern" }, NOW);
    expect(r.gap.sort()).toEqual(["devrel", "security"]);
    const e = await query<{ kind: string; by: string; at: number }>(
      g, "MATCH (:Team {id: 'legal'})-[a:ACKED]->(:Decision {id: 'd-1'}) RETURN a.kind AS kind, a.by AS by, a.at AS at",
    );
    expect(e).toEqual([{ kind: "concern", by: "p-mei", at: NOW }]);
    expect((await ripple(g, "d-1", NOW)).counts.notTold).toBe(2);
  });
});
