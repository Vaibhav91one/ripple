import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CaseFile } from "@/components/reports/CaseFile";
import { PageSkeleton } from "@/components/ui/skeleton";
import { OWNER_ROLE } from "@/lib/actions/executors";
import { NotFound } from "@/lib/graph/queries";
import { reportDetail } from "@/lib/reports";
import { getContext } from "@/lib/server/context";

export default function ReportPage({ params }: PageProps<"/reports/[id]">) {
  return <Suspense fallback={<PageSkeleton />}><Report params={params} /></Suspense>;
}

/** The same rules the write routes apply: the shared demo is read-only; approving send_reminder needs a signed-in admin or its owner role (decide.ts). */
async function viewerCan(id: string): Promise<{ readOnly: boolean; canDecide: boolean }> {
  try {
    const ctx = await getContext();
    await reportDetail(ctx, id);
    const role = ctx.viewer.kind === "user" ? ctx.viewer.role : undefined;
    return { readOnly: ctx.readonly, canDecide: !ctx.readonly && (role === "admin" || role === OWNER_ROLE.send_reminder) };
  } catch (e) {
    // An unknown id gets the route's not-found page; the client fetch of a missing case would log a console 404.
    if (e instanceof NotFound) notFound();
    return { readOnly: true, canDecide: false }; // graph down: the case file shows the banner anyway
  }
}

async function Report({ params }: Pick<PageProps<"/reports/[id]">, "params">) {
  const { id } = await params;
  const can = await viewerCan(id);
  return <CaseFile id={id} {...can} />;
}
