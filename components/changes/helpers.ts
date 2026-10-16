import type { Change, EdgeType } from "@/lib/schemas";

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

/** Display name for an id from the /api/names map; falls back to the id. */
export const nameOf = (names: Record<string, string>) => (id: string) => names[id] ?? id;
