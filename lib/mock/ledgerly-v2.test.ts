import { describe, expect, it } from "vitest";
import * as s from "@/lib/schemas";
import { TEAM_IDS, TeamDashboard } from "@/lib/teams/dashboards";
import { getOverview, getTeamDashboard } from "@/lib/mock/api";
import * as m from "./ledgerly";
import * as v2 from "./ledgerly-v2";

const all = (schema: { parse: (x: unknown) => unknown }, xs: unknown[]) => xs.forEach((x) => schema.parse(x));
const text = (id: string) => [...m.artifacts, ...v2.extraArtifacts].find((a) => a.id === id)!.text;

describe("v2 mocks", () => {
  it("parse with their schemas and have the planned sizes", () => {
    all(s.TicketRow, v2.ticketRows);
    all(s.PrRow, v2.prRows);
    all(s.Incident, v2.incidents);
    all(s.Deal, v2.deals);
    all(s.Contract, v2.contracts);
    all(s.Clause, v2.clauses);
    all(s.Control, v2.controls);
    all(s.Vendor, v2.vendors);
    all(s.Finding, v2.findings);
    all(s.Risk, v2.risks);
    all(s.Page, v2.pages);
    all(s.Goal, v2.goals);
    all(s.Task, v2.tasks);
    all(s.Customer, [...m.customers, m.v2Customer]);
    all(s.Edge, v2.edges);
    s.DocsStats.parse(v2.docsStats);
    expect(m.people).toHaveLength(31);
    expect(v2.ticketRows).toHaveLength(39);
    expect(v2.prRows).toHaveLength(31);
    expect(v2.deals).toHaveLength(16);
    expect(v2.contracts).toHaveLength(8);
    expect(v2.incidents).toHaveLength(6);
    expect(v2.ticketRows.filter((x) => x.v1Related && x.status === "open")).toHaveLength(12);
  });

  it("keeps the v1 numbers and gives every team a person budget of 3-5", () => {
    expect(v2.deals.filter((d) => d.v1Related && d.stage !== "closed_lost")).toHaveLength(3);
    expect(v2.contracts.slice(0, 2).reduce((n, c) => n + m.customers.find((x) => x.id === c.customerId)!.arr, 0)).toBe(180_000);
    for (const id of TEAM_IDS) {
      const n = m.people.filter((p) => p.teamId === id).length;
      expect(n, id).toBeGreaterThanOrEqual(3);
      expect(n, id).toBeLessThanOrEqual(5);
    }
  });

  it("every v2 source quote is verbatim in its artifact", () => {
    const srcs = [...v2.edges.flatMap((e) => (e.src ? [e.src] : [])), ...v2.clauses.map((c) => c.src)];
    expect(srcs.length).toBeGreaterThan(15);
    for (const q of srcs) expect(text(q.artifactId)).toContain(q.quote);
  });

  it("offline dashboards and overview parse", async () => {
    for (const id of TEAM_IDS) expect(TeamDashboard.parse(await getTeamDashboard(id)).team).toBe(id);
    const o = s.Overview.parse(await getOverview());
    expect(o.activity).toHaveLength(14);
    expect(o.activity.some((d) => d.acks > 0)).toBe(true);
  });
});
