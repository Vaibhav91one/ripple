// Document -> quoted, resolved graph proposals. Store (dedupe by hash) -> Artifact node -> chunk -> extract -> quote check -> resolve -> propose.
// Nothing here writes edges: LLM output only ever becomes graph_merge pending actions a person approves.
// Prompt-injection stance: document text reaches the model as fenced data (INGEST_SYSTEM), and the model's output type is edges only.
import { and, eq } from "drizzle-orm";
import type { LanguageModel } from "ai";
import { db } from "../db";
import { documents, entityAliases, orgs } from "../db/schema";
import { propose, type ProposeCtx } from "../actions/propose";
import { graphFor, query, type Graph } from "../graph/client";
import { pickModel } from "../llm";
import { enqueue } from "../queue";
import { chunkText } from "./chunk";
import { embedInput } from "./embed";
import { ENTITY_KINDS, extractChunk, quoteCheck, sha256, type EntityKind, type IngestEdge } from "./extract";
import type { GraphProposal } from "../connectors/define";
import { aliasNorm, createResolver, type Embed, type Node, type Resolution } from "./resolve";

export type SourceKind = "doc" | "message";
export type DocInput = { source: SourceKind; title: string; text: string; ref?: string };
/** Trust weight of where the text came from; edge confidence = extractor score x this. */
export const SOURCE_WEIGHT: Record<SourceKind, number> = { doc: 1, message: 0.8 };
const LABEL: Record<SourceKind, string> = { doc: "Doc", message: "Message" };

export type Deps = { model?: LanguageModel | null; embed?: Embed; graph?: Graph; now?: number };

const defaultEmbed: Embed = async (t) => (await import("./embed")).embedTexts(t);

/** Step 1: store, deduping by sha256 per org. */
export async function storeDocument(ctx: Pick<ProposeCtx, "org">, input: DocInput): Promise<{ id: string; duplicate: boolean }> {
  const d = db();
  const [row] = await d.insert(documents).values({
    orgId: ctx.org.id, sourceKind: input.source, sourceRef: input.ref, title: input.title, text: input.text, sha256: sha256(input.text),
  }).onConflictDoNothing({ target: [documents.orgId, documents.sha256] }).returning({ id: documents.id });
  if (row) return { id: row.id, duplicate: false };
  const [old] = await d.select({ id: documents.id }).from(documents).where(and(eq(documents.orgId, ctx.org.id), eq(documents.sha256, sha256(input.text))));
  return { id: old.id, duplicate: true };
}

/** Upload path: store now, ingest in the worker (`ingest` queue) so the request returns fast. */
export async function submitDocument(ctx: Pick<ProposeCtx, "org">, input: DocInput) {
  const r = await storeDocument(ctx, input);
  if (!r.duplicate) await enqueue("ingest", { documentId: r.id }, {});
  return r;
}

/** Store and process inline (tests, CLI). */
export async function ingestDocument(ctx: Pick<ProposeCtx, "org">, input: DocInput, deps: Deps = {}) {
  const r = await storeDocument(ctx, input);
  return r.duplicate ? { documentId: r.id, duplicate: true, proposals: 0, dropped: 0 } : processDocument(r.id, deps);
}

async function nodesOf(g: Graph, kind: EntityKind): Promise<Node[]> {
  if (!(ENTITY_KINDS as readonly string[]).includes(kind)) throw new Error(`bad kind ${kind}`); // kind is interpolated
  return (await query<{ id: string; name: string | null }>(g, `MATCH (n:${kind}) WHERE n.name IS NOT NULL RETURN n.id AS id, n.name AS name`))
    .map((r) => ({ id: r.id, name: String(r.name) }));
}

/** Steps 2-6 for a stored document. */
export async function processDocument(documentId: string, deps: Deps = {}) {
  const d = db();
  const [doc] = await d.select().from(documents).where(eq(documents.id, documentId));
  if (!doc) throw new Error(`unknown document ${documentId}`);
  const [org] = await d.select().from(orgs).where(eq(orgs.id, doc.orgId));
  const g = deps.graph ?? (await graphFor(org.graphName));
  const embed = deps.embed ?? defaultEmbed;
  const ctx: ProposeCtx = { org: { id: doc.orgId }, viewer: { kind: "system" } };
  const observedAt = Math.floor(doc.createdAt.getTime() / 1000);
  const kind = doc.sourceKind as SourceKind;

  // The Artifact node makes the document searchable and gives edges something to cite.
  const [vec] = await embed([embedInput(doc)]);
  await query(
    g,
    `MERGE (a:${LABEL[kind] ?? "Doc"}:Artifact {id: $id})
     SET a.kind = $kind, a.title = $title, a.text = $text, a.ts = $ts, a.uri = $uri, a.emb = vecf32($vec)`,
    { id: doc.id, kind, title: doc.title, text: doc.text, ts: observedAt, uri: doc.sourceRef ?? "", vec },
  );

  const model = "model" in deps ? deps.model : pickModel("extract");
  if (!model) return { documentId, duplicate: false, proposals: 0, dropped: 0, note: "no extract model configured: document stored and indexed only" };

  // extract per chunk; a quote must be verbatim in the chunk it came from
  const found: IngestEdge[] = [];
  let dropped = 0;
  for (const chunk of chunkText(doc.text)) {
    const r = quoteCheck(chunk, await extractChunk(model, doc.title, chunk));
    found.push(...r.kept);
    dropped += r.dropped.length;
  }

  const aliasRows = await d.select().from(entityAliases).where(eq(entityAliases.orgId, doc.orgId));
  const nodes: Partial<Record<EntityKind, Node[]>> = {};
  const aliases: Partial<Record<EntityKind, Map<string, string>>> = {};
  for (const k of ENTITY_KINDS) {
    nodes[k] = await nodesOf(g, k);
    aliases[k] = new Map(aliasRows.filter((a) => a.kind === k).map((a) => [a.aliasNorm, a.nodeId]));
  }
  const resolve = createResolver(nodes, aliases, embed);

  const proposals: GraphProposal[] = [];
  const suggestions: { kind: EntityKind; mention: string; r: Extract<Resolution, { kind: "suggest" }>; quote: string }[] = [];
  const newNodes = new Set<string>();
  const endpoint = async (k: EntityKind, name: string, quote: string, confidence: number) => {
    const r = await resolve(k, name);
    if (r.kind === "match") return { label: k, id: r.nodeId };
    if (!newNodes.has(r.newId)) {
      newNodes.add(r.newId);
      proposals.push({ op: "merge_node", label: k, id: r.newId, props: { name }, src: doc.id, quote, confidence, structured: false });
      if (r.kind === "suggest") suggestions.push({ kind: k, mention: name, r, quote });
    }
    return { label: k, id: r.newId };
  };

  const seen = new Set<string>();
  for (const e of found) {
    const confidence = Math.round(Math.min(1, Math.max(0, e.confidence)) * (SOURCE_WEIGHT[kind] ?? 0.5) * 100) / 100;
    const from = await endpoint(e.fromKind, e.from, e.quote, confidence);
    const to = await endpoint(e.toKind, e.to, e.quote, confidence);
    const key = `${from.id}|${e.type}|${to.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    proposals.push({
      op: "merge_edge", type: e.type, from, to, props: { observed_at: observedAt }, src: doc.id, quote: e.quote, confidence, structured: false,
    });
  }

  let n = 0;
  for (const p of proposals) {
    const payload = { ...p, props: { ...p.props, ...(p.quote && { quote: p.quote }), confidence: p.confidence } }; // applyProposal stores props on the node/edge
    n += (await propose(ctx, "graph_merge", payload, [{ src: p.src, quote: p.quote, confidence: p.confidence, structured: p.structured }])).created ? 1 : 0;
  }
  for (const s of suggestions) {
    const payload = {
      op: "suggest_merge", kind: s.kind, aliasNorm: aliasNorm(s.mention), nodeId: s.r.nodeId, mention: s.mention,
      score: Math.round(s.r.score * 1000) / 1000, newId: s.r.newId, src: doc.id, quote: s.quote,
    };
    n += (await propose(ctx, "graph_merge", payload, [{ src: doc.id, quote: s.quote }])).created ? 1 : 0;
  }
  return { documentId, duplicate: false, proposals: n, dropped };
}
