import { computeCampaign } from "@/lib/campaign";
import { handle } from "@/lib/server/route";
import { Campaign } from "@/lib/schemas";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(Campaign, (c) => computeCampaign(c, id));
}
