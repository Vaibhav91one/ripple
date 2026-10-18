import { EMPTY_BELOW, orgHome } from "@/lib/assistant/home";
import { starterChips } from "@/lib/assistant/smalltalk";
import { getContext } from "@/lib/server/context";

/** The Assistant's starter chips and onboarding state (#274). The public demo: the cached starters. An org: chips from its own graph, `empty` while it holds almost nothing. */
export async function GET(req: Request) {
  const headers = { "cache-control": "private, no-store" }; // per org and viewer: never shared
  const ctx = await getContext(req).catch(() => null);
  if (!ctx || ctx.org.isDemo) return Response.json({ demo: true, empty: false, sample: false, canManage: false, chips: starterChips() }, { headers });
  const h = await orgHome(ctx.graph);
  const v = ctx.viewer;
  return Response.json({
    demo: false,
    empty: h.nodes < EMPTY_BELOW,
    sample: h.sample,
    canManage: !ctx.readonly && v.kind === "user" && v.role === "admin",
    chips: starterChips(h.changes.length || h.systems.length ? h : { changes: [], systems: [], conflicts: 0 }),
  }, { headers });
}
