import { z } from "zod";
import { agents } from "@/lib/agent/registry";
import { roQuery } from "@/lib/graph/client";
import { load, search } from "@/lib/graph/queries";
import { LABEL_GROUP, MAX_Q, MIN_Q, SearchResult, fulltextQuery, rank, type Group } from "@/lib/search";
import { bad, handle, params } from "@/lib/server/route";

const Q = z.object({ q: z.string().trim().min(MIN_Q).max(MAX_Q) });
const NodeRow = z.object({ id: z.string(), labels: z.array(z.string()), title: z.string(), status: z.string().nullable().optional() });
const RelatedRow = z.object({ id: z.string(), title: z.string(), status: z.string().nullable().optional(), customer: z.string() });
const NOUN: Partial<Record<Group, string>> = { change: "Change", system: "System", customer: "Customer", contract: "Contract", deal: "Deal", team: "Team", person: "Person" };
const ART: Record<string, { group: Group; label: string }> = {
  ticket: { group: "ticket", label: "Ticket" }, pr: { group: "document", label: "Pull request" },
  doc: { group: "document", label: "Document" }, message: { group: "document", label: "Message" },
};
const NODE_CAP = 200;

/**
 * ⌘K search over the viewer's graph (demo, local or the org's, from getContext): name matches on the core nodes, changes that reach a matching
 * customer, full-text on artifacts, and the agent registry. Three graph reads in parallel, ranked and capped per group, then redacted in handle() like every
 * route: a restricted contract or deal comes back as a stub with no name, a restricted source as "Restricted source".
 */
export function GET(req: Request) {
  const p = params(req, Q);
  if (bad(p)) return p;
  const q = p.q.toLowerCase();
  return handle(SearchResult, async ({ graph }) => {
    const ft = fulltextQuery(p.q);
    const [nodes, related, arts] = await Promise.all([
      roQuery(graph, load("search-nodes").text, { q, cap: NODE_CAP }).then((r) => z.array(NodeRow).parse(r)),
      roQuery(graph, load("search-related").text, { q }).then((r) => z.array(RelatedRow).parse(r)),
      ft ? search(graph, ft, 20).then((r) => r.data, () => []) : Promise.resolve([]), // bad full-text syntax is no hits, not a 500
    ]);
    const hits = [
      ...nodes.flatMap((n) => {
        const group = n.labels.map((l) => LABEL_GROUP[l]).find(Boolean);
        return group ? [{ id: n.id, group, label: NOUN[group] ?? group, title: n.title, text: group === "change" && n.status ? `Change · ${n.status}` : undefined, score: 0 }] : [];
      }),
      // score 1: kept even though the title does not match, ranked under direct matches
      ...related.map((d) => ({ id: d.id, group: "change" as const, label: "Change", title: d.title, text: `Touches ${d.customer}`, score: 1 })),
      ...arts.flatMap((a) => (ART[a.kind] ? [{ id: a.id, group: ART[a.kind].group, label: ART[a.kind].label, kind: a.kind, title: a.title, score: a.score }] : [])),
      ...agents().map((a) => ({ id: a.name, group: "agent" as const, label: "Agent", title: a.displayName, text: a.tagline, score: 0 })),
    ];
    return { hits: rank(hits, p.q) }; // the query is not echoed: the client has it
  });
}
