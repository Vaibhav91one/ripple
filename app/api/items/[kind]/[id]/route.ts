import { itemView } from "@/lib/items/view";
import { ItemView } from "@/lib/schemas";
import { handle } from "@/lib/server/route";

export async function GET(_req: Request, ctx: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await ctx.params;
  return handle(ItemView, async ({ graph }) => (await itemView(graph, kind, id)).data);
}
