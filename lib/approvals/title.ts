// A proposal as a sentence with resolved names ("Acme was promised API v1"); raw ids stay in the row's `summary` for auditors.
import { describeEdge } from "../changes";
import type { Edge, Subject } from "../schemas";

/** `name` resolves a node id (/api/names); an unknown id falls back to itself. */
export function proposalTitle(p: { summary: string; subject: Subject | null }, name: (id: string) => string): string {
  const s = p.subject;
  if (!s) return p.summary;
  if (s.op === "merge_edge" && s.from && s.to && s.type) return describeEdge({ from: s.from.id, to: s.to.id, type: s.type as Edge["type"], validFrom: 0 }, name, false);
  if (s.op === "end_edge" && s.from && s.to && s.type) return `Stop: ${describeEdge({ from: s.from.id, to: s.to.id, type: s.type as Edge["type"], validFrom: 0 }, name, false)}`;
  if (s.op === "merge_node" && s.id) return `Add ${s.label?.toLowerCase() ?? "node"} ${name(s.id)}`;
  if (s.op === "suggest_merge" && s.id) return `Treat "${s.mention}" as ${name(s.id)}`;
  return p.summary;
}
