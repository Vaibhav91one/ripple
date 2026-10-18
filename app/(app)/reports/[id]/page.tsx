import { Suspense } from "react";
import { CaseFile } from "@/components/reports/CaseFile";
import { PageSkeleton } from "@/components/ui/skeleton";
import { authEnabled, sessionViewer } from "@/lib/auth";
import { env } from "@/lib/env";

export default function ReportPage({ params }: PageProps<"/reports/[id]">) {
  return <Suspense fallback={<PageSkeleton />}><Report params={params} /></Suspense>;
}

/** Mirrors getContext: the shared demo (no session, not local mode, no graph override) is read-only. */
async function readOnly(): Promise<boolean> {
  const e = env();
  if (e.RIPPLE_GRAPH || (!authEnabled() && e.RIPPLE_MODE === "local")) return false;
  return !(await sessionViewer());
}

async function Report({ params }: Pick<PageProps<"/reports/[id]">, "params">) {
  const { id } = await params;
  return <CaseFile id={id} readOnly={await readOnly()} />;
}
