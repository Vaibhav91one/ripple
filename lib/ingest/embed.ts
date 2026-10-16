// MiniLM-L6-v2 (384-d) embeddings of title + first paragraph, cached by content hash and committed.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pipeline } from "@huggingface/transformers";
import { artifacts } from "../mock/ledgerly";
import { sha256 } from "./extract";

// Resolved from the project root (not import.meta.url): Turbopack treats new URL("./x/") as an asset import.
export const EMBED_DIR = join(process.cwd(), "lib/ingest/cache/embed");
const MODEL = "Xenova/all-MiniLM-L6-v2";

/** title + first paragraph, capped at 200 words. */
export function embedInput(a: { title: string; text: string }): string {
  const first = a.text.trim().split(/\n\s*\n/)[0];
  return `${a.title}\n${first}`.split(/\s+/).slice(0, 200).join(" ");
}

type Extractor = (t: string[], o: object) => Promise<{ tolist(): number[][] }>;
let extractor: Promise<Extractor> | undefined;

export async function embedTexts(texts: string[]): Promise<number[][]> {
  extractor ??= pipeline("feature-extraction", MODEL) as unknown as Promise<Extractor>;
  const out = await (await extractor)(texts, { pooling: "mean", normalize: true });
  return out.tolist().map((v) => v.map((x) => Math.round(x * 1e5) / 1e5));
}

const file = (input: string) => join(EMBED_DIR, `${sha256(input)}.json`);

export function readEmbedding(a: { title: string; text: string }): number[] | null {
  const p = file(embedInput(a));
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as { vector: number[] }).vector : null;
}

/** Compute and cache the missing ones; returns how many were new. */
export async function embedAll(): Promise<number> {
  const todo = artifacts.filter((a) => !readEmbedding(a));
  for (let i = 0; i < todo.length; i += 16) {
    const batch = todo.slice(i, i + 16);
    const vecs = await embedTexts(batch.map(embedInput));
    batch.forEach((a, j) =>
      writeFileSync(file(embedInput(a)), JSON.stringify({ artifactId: a.id, model: MODEL, vector: vecs[j] }) + "\n"),
    );
  }
  return todo.length;
}

if (process.argv[1]?.endsWith("lib/ingest/embed.ts")) {
  embedAll().then((n) => console.log(`embedded ${n} new, ${artifacts.length - n} cached`));
}
