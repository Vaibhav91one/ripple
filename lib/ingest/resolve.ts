// Entity resolution: which existing graph node does a mention in a document refer to?
// Tiers, cheapest first: exact alias -> normalised fuzzy -> MiniLM embedding. Only a score >= MATCH links to an existing node;
// SUGGEST..MATCH is a merge suggestion a person approves; below that the mention becomes a new node proposal.
import type { EntityKind } from "./extract";

export const MATCH = 0.92;
export const SUGGEST = 0.8;

export type Node = { id: string; name: string };
export type Resolution =
  | { kind: "match"; nodeId: string; tier: "alias" | "fuzzy" | "embedding"; score: number }
  | { kind: "suggest"; nodeId: string; score: number; newId: string }
  | { kind: "new"; newId: string };
export type Embed = (texts: string[]) => Promise<number[][]>;

/** Light normalisation: what entity_alias.alias_norm stores. */
export const aliasNorm = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
const SUFFIX = new Set(["inc", "llc", "ltd", "corp", "co", "the", "gmbh", "plc"]);
/** Heavy normalisation: punctuation and company suffixes dropped, word order ignored. */
export const fuzzyKey = (s: string) =>
  aliasNorm(s).replace(/[^\p{L}\p{N}]+/gu, " ").split(" ").filter((w) => w && !SUFFIX.has(w)).sort().join(" ");

const bigrams = (s: string) => { const m = new Map<string, number>(); for (let i = 0; i < s.length - 1; i++) m.set(s.slice(i, i + 2), (m.get(s.slice(i, i + 2)) ?? 0) + 1); return m; };
/** Sørensen–Dice on character bigrams, 0..1. */
export function dice(a: string, b: string): number {
  if (a === b) return 1;
  const x = bigrams(a), y = bigrams(b);
  let hit = 0, n = 0;
  for (const [k, v] of x) { hit += Math.min(v, y.get(k) ?? 0); n += v; }
  for (const v of y.values()) n += v;
  return n ? (2 * hit) / n : 0;
}
const cosine = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0); // MiniLM vectors are unit length

export const slug = (s: string) => fuzzyKey(s).replaceAll(" ", "-") || "unnamed";
export const newNodeId = (kind: EntityKind, name: string) => `${kind.toLowerCase()}-${slug(name)}`;

/**
 * nodes: the graph's existing nodes per kind. aliases: confirmed entity_alias rows (alias_norm -> node id) per kind.
 * ponytail: embeds every candidate name per run; cache vectors on the node if orgs grow past a few thousand entities.
 */
export function createResolver(nodes: Partial<Record<EntityKind, Node[]>>, aliases: Partial<Record<EntityKind, Map<string, string>>>, embed: Embed) {
  const vecs = new Map<string, number[]>();
  const vec = async (texts: string[]) => {
    const todo = [...new Set(texts)].filter((t) => !vecs.has(t));
    if (todo.length) (await embed(todo)).forEach((v, i) => vecs.set(todo[i], v));
    return texts.map((t) => vecs.get(t)!);
  };

  return async function resolve(kind: EntityKind, name: string): Promise<Resolution> {
    const pool = nodes[kind] ?? [];
    const key = aliasNorm(name);
    // 1. exact alias: a confirmed alias, a node's own name, or its id
    const alias = aliases[kind]?.get(key) ?? pool.find((n) => aliasNorm(n.name) === key || n.id === name)?.id;
    if (alias) return { kind: "match", nodeId: alias, tier: "alias", score: 1 };
    // 2. normalised fuzzy
    const fk = fuzzyKey(name);
    let best: { n: Node; s: number } | undefined;
    for (const n of pool) {
      const s = dice(fk, fuzzyKey(n.name));
      if (!best || s > best.s) best = { n, s };
    }
    if (best && best.s >= MATCH) return { kind: "match", nodeId: best.n.id, tier: "fuzzy", score: best.s };
    // 3. embedding similarity
    const newId = newNodeId(kind, name);
    if (!pool.length) return { kind: "new", newId };
    const [q, ...cs] = await vec([name, ...pool.map((n) => n.name)]);
    let top = { i: 0, s: -1 };
    cs.forEach((c, i) => { const s = cosine(q, c); if (s > top.s) top = { i, s }; });
    const nodeId = pool[top.i].id;
    if (top.s >= MATCH) return { kind: "match", nodeId, tier: "embedding", score: top.s };
    if (top.s >= SUGGEST) return { kind: "suggest", nodeId, score: top.s, newId };
    return { kind: "new", newId };
  };
}
