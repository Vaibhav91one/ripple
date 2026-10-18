import { Suspense } from "react";
import { FileText } from "lucide-react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default function ReportPage({ params }: PageProps<"/reports/[id]">) {
  return <Suspense fallback={<PageSkeleton />}><Report params={params} /></Suspense>;
}

async function Report({ params }: Pick<PageProps<"/reports/[id]">, "params">) {
  const { id } = await params;
  return (
    <>
      <PageHeader title={`Case ${id}`} crumbs={[{ label: "Reports", href: "/reports" }, { label: id }]} />
      <Card>
        <EmptyState icon={FileText} title="This case file is being wired up" action={{ label: "All reports", href: "/reports" }}>
          Notices, acks, approvals and agent runs for this change will show here.
        </EmptyState>
      </Card>
    </>
  );
}
