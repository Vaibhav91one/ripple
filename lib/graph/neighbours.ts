// Neighbour list of one node from its edges. Pure and client-safe: /graph's side panel and the item endpoint share it.
export type Neighbour = { id: string; title: string; type: string };

/** One entry per edge touching `id`; `titles` maps node id -> display title (falls back to the id). */
export function neighboursOf(id: string, edges: { from: string; to: string; type: string }[], titles: Map<string, string>): Neighbour[] {
  return edges
    .filter((e) => e.from === id || e.to === id)
    .map((e) => {
      const other = e.from === id ? e.to : e.from;
      return { id: other, title: titles.get(other) ?? other, type: e.type };
    });
}
