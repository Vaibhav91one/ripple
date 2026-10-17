// pnpm eval: run the 16 questions against the `demo` graph (read-only) and print a markdown table.
import { closeClient, graphFor } from "../graph/client";
import { evaluate, toMarkdown } from "./questions";

graphFor(process.env.RIPPLE_GRAPH ?? "demo")
  .then(evaluate)
  .then((rows) => {
    console.log(toMarkdown(rows));
    if (rows.some((r) => !r.pass)) process.exitCode = 1;
  })
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(closeClient);
