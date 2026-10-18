import { loadSample, removeSample } from "@/lib/assistant/sample";
import { getContext } from "@/lib/server/context";

// "Load the sample company" (#274): POST seeds the Ledgerly demo into this org's own graph, DELETE removes it. Admins only, audited.
// The public demo (and its shared `demo` graph) is refused: lib/assistant/sample.ts also refuses any graph that is not t_<orgId>.
async function run(req: Request, op: "load" | "remove") {
  const ctx = await getContext(req);
  const v = ctx.viewer;
  const ev = { action: `sample.${op}`, resourceType: "graph", resourceId: ctx.org.graphName };
  if (ctx.readonly || ctx.org.isDemo || v.kind !== "user" || v.role !== "admin") {
    await ctx.audit({ ...ev, outcome: "deny" });
    return Response.json({ error: "forbidden", message: "Only an admin of this workspace can change the sample company." }, { status: 403 });
  }
  try {
    const result = op === "load" ? await loadSample(ctx.org.graphName, ctx.now) : await removeSample(ctx.org.graphName);
    await ctx.audit({ ...ev, meta: { result } });
    return Response.json({ ok: true, result });
  } catch (e) {
    await ctx.audit({ ...ev, outcome: "deny", meta: { error: true } });
    return Response.json({ error: "failed", message: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}

export const POST = (req: Request) => run(req, "load");
export const DELETE = (req: Request) => run(req, "remove");
