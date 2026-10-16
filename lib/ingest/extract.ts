// Per-artifact edge extraction with a verbatim-quote check and a committed content-hash cache.
// Cache hit => the model is never called, so the demo runs with no API key.
import { createHash } from "node:crypto";
import { join } from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";
import { pickModel } from "../llm";
import { artifacts, edges as mockEdges } from "../mock/ledgerly";
import { EdgeType } from "../schemas";

// Resolved from the project root (not import.meta.url): Turbopack treats new URL("./x/") as an asset import.
export const CACHE_DIR = join(process.cwd(), "lib/ingest/cache/extract");

export const ExtractedEdge = z.object({
  from: z.string().describe("id of the source entity"),
  type: EdgeType,
  to: z.string().describe("id of the target entity"),
  quote: z.string().describe("verbatim text from the artifact that supports this edge"),
});
export type ExtractedEdge = z.infer<typeof ExtractedEdge>;
const Extraction = z.object({ edges: z.array(ExtractedEdge) });

export type CacheEntry = {
  origin: "model" | "seeded-from-mock";
  artifactId: string;
  sha256: string;
  edges: ExtractedEdge[];
  dropped: ExtractedEdge[];
};

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/** Keep edges whose quote is a verbatim substring of `text` (whitespace-normalised). */
export function quoteCheck(text: string, edges: ExtractedEdge[]) {
  const t = norm(text);
  const kept: ExtractedEdge[] = [];
  const dropped: ExtractedEdge[] = [];
  for (const e of edges) {
    const q = norm(e.quote);
    (q && t.includes(q) ? kept : dropped).push(e);
  }
  return { kept, dropped };
}

const cachePath = (hash: string) => join(CACHE_DIR, `${hash}.json`);

export function readCache(text: string): CacheEntry | null {
  const p = cachePath(sha256(text));
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as CacheEntry) : null;
}

const write = (e: CacheEntry) => writeFileSync(cachePath(e.sha256), JSON.stringify(e, null, 2) + "\n");

/** Returns null when uncached and no model is available (caller reports "needs a key"). */
export async function extractArtifact(
  a: { id: string; title: string; text: string },
  model: LanguageModel | null,
): Promise<(CacheEntry & { cached: boolean }) | null> {
  const hit = readCache(a.text);
  if (hit) return { ...hit, cached: true };
  if (!model) return null;
  const { output } = await generateText({
    model,
    output: Output.object({ schema: Extraction }),
    system:
      "Extract relationships between entities (people, teams, systems, customers, contracts, decisions) from one document. " +
      "Each edge needs a quote copied verbatim from the document. Only emit edges the text directly states.",
    prompt: `Artifact id: ${a.id}\nTitle: ${a.title}\n\n${a.text}`,
  });
  const { kept, dropped } = quoteCheck(a.text, output.edges);
  const entry: CacheEntry = { origin: "model", artifactId: a.id, sha256: sha256(a.text), edges: kept, dropped };
  write(entry);
  return { ...entry, cached: false };
}

/** Seed the cache from the mock's sourced edges (no model). Skips artifacts already cached. */
export function seedCacheFromMock(): number {
  let n = 0;
  for (const a of artifacts) {
    if (readCache(a.text)) continue;
    const es = mockEdges
      .filter((e) => e.src?.artifactId === a.id)
      .map((e) => ({ from: e.from, type: e.type, to: e.to, quote: e.src!.quote }));
    const { kept, dropped } = quoteCheck(a.text, es);
    write({ origin: "seeded-from-mock", artifactId: a.id, sha256: sha256(a.text), edges: kept, dropped });
    n++;
  }
  return n;
}

async function main() {
  if (process.argv.includes("--seed-from-mock")) {
    console.log(`seeded ${seedCacheFromMock()} cache files from the mock`);
    return;
  }
  const model = pickModel("extract");
  const need: string[] = [];
  let hits = 0;
  for (const a of artifacts) {
    const r = await extractArtifact(a, model);
    if (!r) need.push(a.id);
    else if (r.cached) hits++;
    else console.log(`extracted ${a.id}: ${r.edges.length} kept, ${r.dropped.length} dropped`);
  }
  console.log(`${hits} cached, ${need.length} need a model`);
  if (need.length) {
    console.log("set LLM_PROVIDER, MODEL_EXTRACT and LLM_API_KEY (ollama needs no key) to extract:", need.join(", "));
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith("lib/ingest/extract.ts")) main();
