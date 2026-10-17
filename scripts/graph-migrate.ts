// `pnpm graph:migrate [graph]` applies pending graph migrations (default graph: demo).
import { closeClient, graphFor } from "../lib/graph/client";
import { migrateGraph } from "../lib/graph/migrate";

const name = process.argv[2] ?? "demo";
graphFor(name)
  .then(migrateGraph)
  .then((ids) => console.log(`graph ${name}: ${ids.length ? `applied ${ids.join(", ")}` : "up to date"}`))
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(closeClient);
