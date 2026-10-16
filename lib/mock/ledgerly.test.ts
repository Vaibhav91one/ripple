import { describe, expect, it, vi } from "vitest";
import * as m from "@/lib/mock/ledgerly";
import * as s from "@/lib/schemas";
import { askStream, getChanges, getInbox, getWhoKnows, getRipple, getSource } from "@/lib/mock/api";

const parseAll = (schema: { parse: (x: unknown) => unknown }, xs: unknown[]) =>
  xs.forEach((x) => schema.parse(x));
const text = (id: string) => m.artifacts.find((a) => a.id === id)!.text;

describe("ledgerly mocks", () => {
  it("parse with their schemas", () => {
    parseAll(s.Team, m.teams);
    parseAll(s.Person, m.people);
    parseAll(s.System, m.systems);
    parseAll(s.Customer, [...m.customers, m.v2Customer]);
    parseAll(s.Deal, m.deals);
    parseAll(s.Contract, m.contracts);
    parseAll(s.Decision, m.decisions);
    parseAll(s.Artifact, m.artifacts);
    parseAll(s.Edge, m.edges);
    parseAll(s.Conflict, [m.conflict]);
    parseAll(s.Incident, m.incidents);
    parseAll(s.Task, m.tasks);
    parseAll(s.Ack, m.acks);
    parseAll(s.Brief, m.briefs);
    parseAll(s.Change, m.changes);
    parseAll(s.BottleneckRow, m.bottleneck);
    parseAll(s.WhoKnowsRow, m.whoKnows["api-v1"]);
    parseAll(s.InboxItem, m.inboxes["p-priya"]);
    parseAll(s.StreamEvent, m.askEvents);
    s.RippleResult.parse(m.rippleResult);
    expect(m.teams).toHaveLength(9);
  });

  it("counts match the story", () => {
    const r = m.rippleResult;
    const kinds = (k: string) => r.nodes.filter((n) => n.kind === k).length;
    expect(kinds("customer")).toBe(40);
    expect(kinds("ticket")).toBe(12);
    expect(kinds("deal")).toBe(3);
    expect(kinds("contract")).toBe(2);
    const atRisk = m.contracts.reduce(
      (n, c) => n + m.customers.find((x) => x.id === c.customerId)!.arr,
      0,
    );
    expect(atRisk).toBe(180_000);
    expect(r.counts).toEqual({ teamsAffected: 5, notTold: 3, conflicts: 1, customers: 40, tickets: 12, deals: 3, contracts: 2, arrAtRisk: 180_000 });
    expect(kinds("team")).toBe(5);
    expect(r.nodes.some((n) => n.id === "eng" && n.kind === "team")).toBe(false);
    expect([...r.gap].sort()).toEqual(["devrel", "legal", "security"]);
    expect(r.teams.filter((t) => t.involved).map((t) => t.teamId)).toEqual(
      expect.arrayContaining(["support", "sales"]),
    );
    expect(r.conflicts).toHaveLength(1);
    expect(m.briefs.map((b) => b.teamId).sort()).toEqual(["devrel", "legal", "security"]);
  });

  it("every Source.quote is verbatim in its artifact", () => {
    const sources: s.Source[] = [
      ...m.edges.flatMap((e) => (e.src ? [e.src] : [])),
      ...m.conflict.sources,
      ...m.rippleResult.teams.flatMap((t) => t.why.map((w) => w.source)),
      ...m.briefs.flatMap((b) => b.claims.flatMap((c) => c.sources)),
      ...m.askEvents.flatMap((e) => (e.type === "citation" ? e.sources : [])),
    ];
    expect(sources.length).toBeGreaterThan(20);
    for (const q of sources) expect(text(q.artifactId)).toContain(q.quote);
  });

  it("decoys are not in the ripple", () => {
    const ids = new Set(m.rippleResult.nodes.map((n) => n.id));
    for (const id of ["art-tkt-closed", "art-tkt-invoice", "deal-lost", "cust-41"])
      expect(ids.has(id)).toBe(false);
  });

  it("api returns the mocks", async () => {
    expect((await getRipple("d-1")).gap).toHaveLength(3);
    await expect(getRipple("nope")).rejects.toThrow();
    expect((await getSource("art-rfc14")).docKind).toBe("rfc");
    expect(await getInbox("p-priya")).toHaveLength(3);
    expect((await getWhoKnows("api-v1"))[0].personId).toBe("p-priya");
    expect((await getChanges(0)).length).toBe(m.changes.length);
    // askStream parses the /api/ask SSE body (frames split mid-chunk)
    const sse = m.askEvents.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
    const mid = Math.floor(sse.length / 2);
    const enc = new TextEncoder();
    vi.stubGlobal("fetch", async () =>
      new Response(new ReadableStream({ start(c) { c.enqueue(enc.encode(sse.slice(0, mid))); c.enqueue(enc.encode(sse.slice(mid))); c.close(); } })));
    const events: unknown[] = [];
    for await (const e of askStream(m.askQuestion)) events.push(e);
    vi.unstubAllGlobals();
    expect(events).toEqual(m.askEvents);
  });
});
