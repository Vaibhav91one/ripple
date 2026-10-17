import { z } from "zod";
import { changeApprovals } from "@/lib/campaign";
import { handle } from "@/lib/server/route";
import { ChangeApproval } from "@/lib/schemas";

/** This change's pending actions the viewer may decide. #203's /api/approvals is the full list; this one is scoped to one change. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(z.array(ChangeApproval), (c) => changeApprovals(c, id));
}
