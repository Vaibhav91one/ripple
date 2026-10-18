import { FileText } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default function ReportsPage() {
  return (
    <>
      <PageHeader title="Reports" subtitle="One place per change, with everything done for it" />
      <Card>
        <EmptyState icon={FileText} title="One case file per change" action={{ label: "Ask the assistant", href: "/" }}>
          Every notice, ack, approval, issue and agent run for a change, in one place. The case files are being wired up.
        </EmptyState>
      </Card>
    </>
  );
}
