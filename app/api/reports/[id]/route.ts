import { reportDetail } from "@/lib/reports";
import { handle } from "@/lib/server/route";
import { ReportDetail } from "@/lib/schemas/reports";

/** The case file of one change: teams expected vs done, the merged timeline, conflicts and the result numbers. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(ReportDetail, (ctx) => reportDetail(ctx, id));
}
