// pnpm eval: run the 16 questions against the `demo` graph (read-only) and print a markdown table.
import { closeClient } from "../graph/client";
import { getContext } from "../server/context";
import { evaluate, toMarkdown } from "./questions";

getContext()
  .then((ctx) => evaluate(ctx.graph))
  .then((rows) => {
    console.log(toMarkdown(rows));
    if (rows.some((r) => !r.pass)) process.exitCode = 1;
  })
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(closeClient);
