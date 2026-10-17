// One endpoint's worth of data for any graph node: the node, why changes reach it, its neighbours, its dated edges, who knows it.
import { z } from "zod";
import { roQuery, type Graph } from "../graph/client";
import { neighboursOf } from "../graph/neighbours";
import { NotFound, load, whoKnows, type Cypher } from "../graph/queries";
import type { ItemView } from "../schemas/items";
import { ITEM_KINDS } from "./kinds";

const num = z.coerce.number();
const Edge = z.object({
  type: z.string(), dir: z.enum(["out", "in"]), otherId: z.string(), otherLabel: z.string().nullable(), otherTitle: z.string().nullable(),
  validFrom: num, validTo: num.nullable(), src: z.string().nullable(), quote: z.string().nullable(),
});
const Why = z.object({
  changeId: z.string(), changeTitle: z.string(), changeStatus: z.string().nullable(),
  nodes: z.array(z.object({ id: z.string(), label: z.string().nullable(), name: z.string().nullish() })),
  rels: z.array(z.object({ type: z.string(), src: z.string().nullable(), quote: z.string().nullable() })),
});
/** Kinds the who-knows query understands: a system, or an artifact (PR, ticket, doc, message) about one. */
const KNOWABLE = new Set(["system", "pr", "ticket", "doc", "message"]);

export async function itemView(g: Graph, kind: string, id: string): Promise<{ data: ItemView; cypher: Cypher[] }> {
  const ad = Object.hasOwn(ITEM_KINDS, kind) ? ITEM_KINDS[kind] : undefined;
  if (!ad) throw new NotFound(`unknown item kind ${kind}`);
  const p = { id, label: ad.graphLabel };
  const cs = ["item-node", "item-edges", "item-why"].map(load);
  const [node] = z.array(z.object({ props: z.record(z.string(), z.unknown()) })).parse(await roQuery(g, cs[0].text, p));
  if (!node) throw new NotFound(`unknown ${kind} ${id}`);
  const [edgeRows, whyRows, who] = await Promise.all([
    roQuery(g, cs[1].text, p), roQuery(g, cs[2].text, p), KNOWABLE.has(kind) ? whoKnows(g, id) : null,
  ]);
  const edges = z.array(Edge).parse(edgeRows).sort((x, y) => y.validFrom - x.validFrom).map((e) => ({
    type: e.type, dir: e.dir, other: { id: e.otherId, label: e.otherLabel ?? "Node", title: e.otherTitle ?? e.otherId },
    validFrom: e.validFrom, validTo: e.validTo, src: e.src, quote: e.quote,
  }));
  // neighbours: the nodes on current edges, built by the same logic /graph's side panel uses
  const current = edges.filter((e) => e.validTo === null);
  const byKey = new Map(current.map((e) => [`${e.other.id}|${e.type}`, e]));
  const neighbours = neighboursOf(
    id,
    current.map((e) => (e.dir === "out" ? { from: id, to: e.other.id, type: e.type } : { from: e.other.id, to: id, type: e.type })),
    new Map(current.map((e) => [e.other.id, e.other.title])),
  )
    .filter((x, i, xs) => xs.findIndex((y) => y.id === x.id && y.type === x.type) === i)
    .map((x) => {
      const e = byKey.get(`${x.id}|${x.type}`)!;
      return { ...x, label: e.other.label, dir: e.dir };
    });
  const why = z.array(Why).parse(whyRows).map(({ nodes, ...w }) => ({ ...w, path: nodes.map((n) => ({ ...n, label: n.label ?? "Node" })) }));
  const props = node.props;
  return {
    data: {
      kind, id, label: ad.label, icon: ad.icon, title: ad.title(props), status: ad.status(props), owner: ad.owner(props), sourceUrl: ad.sourceUrl(props),
      why, neighbours, edges, whoKnows: who?.data ?? [],
    },
    cypher: [...cs, ...(who?.cypher ?? [])],
  };
}
