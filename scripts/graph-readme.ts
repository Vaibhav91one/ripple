// pnpm graph:readme [--keep]: seed a throwaway graph, regenerate the README's graph map and proof from it, drop it. Never touches `demo`.
import { execFileSync } from "node:child_process";
import { closeClient, graphFor } from "../lib/graph/client";

const name = `readme_map_${process.pid}`;
const tsx = (...a: string[]) => execFileSync("pnpm", ["--silent", "exec", "tsx", ...a], { stdio: "inherit" });

async function main() {
  const { seed } = await import("../lib/ingest/seed");
  await seed(name);
  try {
    tsx("scripts/graph-map.ts", name);
    tsx("scripts/graph-proof.ts", name);
  } finally {
    await (await graphFor(name)).delete();
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(closeClient);
