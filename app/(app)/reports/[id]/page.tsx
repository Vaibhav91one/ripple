import { Suspense } from "react";
import { CaseFile } from "@/components/reports/CaseFile";
import { PageSkeleton } from "@/components/ui/skeleton";
import { OWNER_ROLE } from "@/lib/actions/executors";
import { getContext } from "@/lib/server/context";

export default function ReportPage({ params }: PageProps<"/reports/[id]">) {
  return <Suspense fallback={<PageSkeleton />}><Report params={params} /></Suspense>;
}

/** The same rules the write routes apply: the shared demo is read-only; approving send_reminder needs a signed-in admin or its owner role (decide.ts). */
async function viewerCan(): Promise<{ readOnly: boolean; canDecide: boolean }> {
  try {
    const ctx = await getContext();
    const role = ctx.viewer.kind === "user" ? ctx.viewer.role : undefined;
    return { readOnly: ctx.readonly, canDecide: !ctx.readonly && (role === "admin" || role === OWNER_ROLE.send_reminder) };
  } catch {
    return { readOnly: true, canDecide: false }; // graph down: the case file shows the banner anyway
  }
}

async function Report({ params }: Pick<PageProps<"/reports/[id]">, "params">) {
  const { id } = await params;
  const can = await viewerCan();
  return <CaseFile id={id} {...can} />;
}
