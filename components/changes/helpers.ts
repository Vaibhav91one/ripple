import type { Change, EdgeType } from "@/lib/schemas";
import * as m from "@/lib/mock/ledgerly";

export const DAY = 86_400;

/** Default `since`: 7 days before the latest change (0 when there are none). */
export function defaultSince(all: Change[]): number {
  if (!all.length) return 0;
  return Math.max(...all.map((c) => c.at)) - 7 * DAY;
}

/** Edge types present in `changes`, with counts, most frequent first. */
export function typeCounts(changes: Change[]): [EdgeType, number][] {
  const n = new Map<EdgeType, number>();
  for (const c of changes) n.set(c.edge.type, (n.get(c.edge.type) ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** Empty `types` means no filter. Newest first. */
export function filterChanges(changes: Change[], types: EdgeType[]): Change[] {
  return changes
    .filter((c) => !types.length || types.includes(c.edge.type))
    .sort((a, b) => b.at - a.at);
}

// ponytail: names come straight from the mock until Phase 3 ships a lookup in lib/api.ts.
const names = new Map<string, string>(
  [m.teams, m.people, m.systems, m.customers, m.decisions, m.deals, m.contracts]
    .flat()
    .map((x) => [x.id, "name" in x ? x.name : x.title] as [string, string]),
);
export const nameOf = (id: string) => names.get(id) ?? id;
