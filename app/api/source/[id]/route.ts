import { source } from "@/lib/graph/queries";
import { handle } from "@/lib/server/route";
import { Artifact } from "@/lib/schemas";


export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(Artifact, async ({ graph }) => (await source(graph, id)).data);
}
