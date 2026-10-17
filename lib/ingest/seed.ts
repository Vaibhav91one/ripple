// Deterministic, idempotent Ledgerly seed (MERGE on id). Reuses lib/mock/ledgerly.ts.
// Dates are epoch seconds. valid_to absent = current edge. Embeddings come from the committed cache (pnpm embed).
import { closeClient, graphFor, query, type Graph } from "../graph/client";
import { readEmbedding } from "./embed";
import { ensureSchema } from "../graph/schema";
import * as m from "../mock/ledgerly";
import * as v2 from "../mock/ledgerly-v2";
import { EdgeType, type Artifact } from "../schemas";

const day = (d: string) => Math.floor(Date.parse(`${d}T09:00:00Z`) / 1000);
const kindLabel: Record<Artifact["kind"], string> = { doc: "Doc", ticket: "Ticket", message: "Message", pr: "PR" };
const art = (id: string) => m.artifacts.find((a) => a.id === id)!;

type Row = { id: string; props: Record<string, unknown> };
type EdgeRow = {
  from: string; to: string; type: string; valid_from: number; valid_to: number | null;
  observed_at: number; src: string | null; quote: string | null; extra: Record<string, unknown>;
};

const clean = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null));

async function writeNodes(g: Graph, labels: string, rows: Row[]) {
  await query(g, `UNWIND $rows AS row MERGE (n:${labels} {id: row.id}) SET n += row.props`, { rows });
}

function edge(
  from: string, to: string, type: string, validFrom: number,
  o: { validTo?: number | null; src?: { artifactId: string; quote: string }; extra?: Record<string, unknown> } = {},
): EdgeRow {
  return {
    from, to, type, valid_from: validFrom, valid_to: o.validTo ?? null,
    observed_at: validFrom, src: o.src?.artifactId ?? null, quote: o.src?.quote ?? null, extra: o.extra ?? {},
  };
}

function buildEdges(): EdgeRow[] {
  const sunsetOn = day("2027-01-31");
  const out: EdgeRow[] = [];
  // mock edges; extracted-style ones carry src + quote
  for (const e of m.edges) {
    const extra: Record<string, unknown> = {};
    if (e.type === "SUNSETS") extra.on = sunsetOn; // the date from RFC-14
    if (e.type === "USES") extra.last_seen = day("2026-10-10");
    if (e.type === "GUARANTEES") extra.until = m.contracts.find((c) => c.id === e.from)!.endsAt;
    out.push(edge(e.from, e.to, e.type, e.validFrom, { validTo: e.validTo, src: e.src, extra }));
  }
  // structure the mock leaves implicit
  for (const p of m.people) out.push(edge(p.id, p.teamId, "MEMBER_OF", day("2026-01-01")));
  out.push(edge("eng", "api-v1", "OWNS", day("2026-01-01")));
  // ticket i was raised by customer cust-(i+3), handled by Ana (mock: customers.slice(2, 14))
  m.customers.slice(2, 14).forEach((c, i) => {
    out.push(edge(`art-tkt-${i + 1}`, c.id, "RAISED_BY", art(`art-tkt-${i + 1}`).ts));
    out.push(edge(`art-tkt-${i + 1}`, "p-ana", "HANDLED_BY", art(`art-tkt-${i + 1}`).ts));
  });
  for (const d of m.deals) out.push(edge(d.id, d.customerId, "PARTY_TO", day("2026-01-01")));
  for (const c of m.contracts) out.push(edge(c.id, c.customerId, "PARTY_TO", day("2025-07-01")));
  // teams the mock marks as affected (rippleResult.edges), and who the decision involved
  for (const e of m.rippleResult.edges)
    if (e.type === "AFFECTED") out.push(edge(e.from, e.to, "AFFECTED", m.decisions[1].decidedAt));
  for (const a of m.acks) {
    out.push(edge(a.teamId, a.decisionId, "INVOLVED_IN", a.at));
    out.push(edge(a.teamId, a.decisionId, "ACKED", a.at, { extra: { kind: a.kind, by: a.by } }));
  }
  for (const i of m.incidents) out.push(edge(i.id, i.systemId, "AFFECTED", i.startedAt));
  for (const t of v2.tasks) {
    out.push(edge(t.id, t.teamId, "ASSIGNED", t.createdAt));
    // `by` = who asked for the review (the inbox's "from"); mock tasks don't carry it
    if (t.assigneeId) out.push(edge(t.id, t.assigneeId, "ASSIGNED", t.createdAt, t.id === "task-2" ? { extra: { by: "p-prod" } } : {}));
  }
  // ownership/handling the ripple and bottleneck queries read
  out.push(edge("security", "auth-service", "OWNS", day("2026-01-01"), { src: { artifactId: "art-auth-design", quote: "auth-service verifies v1 tokens" } }));
  out.push(edge("devrel", "api-v1", "CARES_ABOUT", day("2026-01-01"), { src: { artifactId: "art-sdk-docs", quote: "still point at api.ledgerly.test/v1" } }));
  for (const c of m.contracts) out.push(edge(c.id, "legal", "MANAGED_BY", day("2025-07-01")));
  for (const d of m.deals) out.push(edge(d.id, "sales", "OWNED_BY", day("2026-01-01")));
  // v2 dashboard edges (dated): new tickets/PRs, clauses, controls, findings, blockers, person acks
  for (const e of v2.edges) out.push(edge(e.from, e.to, e.type, e.validFrom, { validTo: e.validTo, src: e.src, extra: e.extra }));
  // PRs: Priya authored nine about api-v1, Sam reviewed six of them
  for (let i = 1; i <= 9; i++) {
    out.push(edge("p-priya", `pr-v1-${i}`, "AUTHORED", day("2026-09-01")));
    out.push(edge(`pr-v1-${i}`, "api-v1", "ABOUT", day("2026-09-01")));
    if (i <= 6) out.push(edge("p-sam", `pr-v1-${i}`, "REVIEWED", day("2026-09-02")));
  }
  // open requests between teams: [waiting, blocker, age in days at 2026-10-17]
  const waits: [string, string, number][] = [
    ["sales", "legal", 17], ["eng", "legal", 10], ["finance", "legal", 7], ["product", "legal", 4],
    ["eng", "security", 11], ["devrel", "security", 6], ["data", "security", 4],
    ["support", "eng", 6], ["product", "eng", 3],
  ];
  for (const [w, b, age] of waits) out.push(edge(w, b, "WAITING_ON", day("2026-10-17") - age * 86400));
  // decoys (seed-only; the mock has no edges for them): ended or pointing elsewhere
  const closed = art("art-tkt-closed"), invoice = art("art-tkt-invoice"), lost = art("art-msg-lost");
  out.push(edge(closed.id, "api-v1", "ABOUT", closed.ts, { validTo: closed.ts + 86400, src: { artifactId: closed.id, quote: "timeout from API v1" } }));
  out.push(edge(invoice.id, "billing", "ABOUT", invoice.ts, { src: { artifactId: invoice.id, quote: "v1 invoice template" } }));
  out.push(edge("deal-lost", "api-v1", "PROMISED", lost.ts, { validTo: m.deals.at(-1)!.closeDate, src: { artifactId: lost.id, quote: "asked about API v1 pricing" } }));
  return out;
}

export async function seed(graphName: string): Promise<void> {
  const g = await graphFor(graphName);
  await ensureSchema(g);

  const simple: [string, ({ id: string } & Record<string, unknown>)[]][] = [
    ["Team", m.teams], ["Person", m.people], ["System", [...m.systems, ...v2.chainSystems]],
    ["Customer", [...m.customers, m.v2Customer]], ["Deal", v2.deals], ["Contract", v2.contracts],
    ["Decision", m.decisions], ["Incident", v2.incidents], ["Task", v2.tasks],
    ["Clause", v2.clauses.map((c) => ({ ...c, src: undefined }))], ["Control", v2.controls], ["Framework", v2.frameworks],
    ["Vendor", v2.vendors], ["Finding", v2.findings], ["Risk", v2.risks], ["Page", v2.pages], ["Goal", v2.goals],
    ["DocsStats", [{
      id: v2.docsStats.id,
      failedSearchesJson: JSON.stringify(v2.docsStats.failedSearches),
      sdkAdoptionJson: JSON.stringify(v2.docsStats.sdkAdoption),
    }]],
  ];
  for (const [label, xs] of simple)
    await writeNodes(g, label, xs.map((x) => ({ id: x.id, props: clean(x) })));

  // ticket meta (priority, SLA, assignee) rides on the Ticket artifact nodes; PR meta on the PR nodes
  const ticketMeta = new Map(v2.ticketRows.map((t) => [t.id, {
    priority: t.priority, createdAt: t.createdAt, firstResponseAt: t.firstResponseAt, slaDueAt: t.slaDueAt,
    assigneeId: t.assigneeId, v1Related: t.v1Related,
  }]));
  const prMeta = (p: (typeof v2.prRows)[number]) => ({
    repo: p.repo, state: p.state, additions: p.additions, deletions: p.deletions, createdAt: p.createdAt,
    firstReviewAt: p.firstReviewAt, mergedAt: p.mergedAt, reviewerIds: p.reviewerIds, v1Related: p.v1Related,
  });
  const prMetaById = new Map(v2.prRows.map((p) => [p.id, prMeta(p)]));
  for (const kind of Object.keys(kindLabel) as Artifact["kind"][]) {
    const rows = [...m.artifacts, ...v2.extraArtifacts].filter((a) => a.kind === kind)
      .map((a) => ({ id: a.id, props: clean({ ...a, author: a.authorId, authorId: undefined, ...ticketMeta.get(a.id), ...prMetaById.get(a.id) }) }));
    if (rows.length) await writeNodes(g, `${kindLabel[kind]}:Artifact`, rows);
  }

  // vectors from lib/ingest/cache/embed (artifacts not embedded yet are skipped)
  const embRows = m.artifacts.flatMap((a) => {
    const v = readEmbedding(a);
    return v ? [{ id: a.id, v }] : [];
  });
  if (embRows.length)
    await query(g, "UNWIND $rows AS row MATCH (a:Artifact {id: row.id}) SET a.emb = vecf32(row.v)", { rows: embRows });

  await writeNodes(g, "PR:Artifact", v2.prRows.filter((p) => !m.artifacts.some((a) => a.id === p.id)).map((p) => ({
    id: p.id,
    props: clean({
      id: p.id, kind: "pr", title: p.title, text: p.id.startsWith("pr-v1-") ? `Fixes v1 auth handler bug ${p.id.slice(6)}` : `${p.title}.`,
      ts: p.createdAt, uri: `https://git.ledgerly.test/pr/${p.id.replace(/^pr-(v1-)?/, "")}`, author: p.authorId, ...prMeta(p),
    }),
  })));

  const byType = new Map<string, EdgeRow[]>();
  for (const e of buildEdges()) byType.set(e.type, [...(byType.get(e.type) ?? []), e]);
  for (const [type, rows] of byType) {
    EdgeType.parse(type); // whitelist: the type is the only interpolated token
    await query(
      g,
      `UNWIND $rows AS row
       MATCH (a {id: row.from}) MATCH (b {id: row.to})
       MERGE (a)-[r:${type}]->(b)
       SET r += row.extra, r.valid_from = row.valid_from, r.valid_to = row.valid_to,
           r.observed_at = row.observed_at, r.src = row.src, r.quote = row.quote`,
      { rows },
    );
  }
}

if (process.argv[1]?.endsWith("lib/ingest/seed.ts")) {
  seed("demo")
    .then(() => console.log("seeded graph demo"))
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(closeClient);
}
