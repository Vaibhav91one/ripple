import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader title="Analytics" subtitle="Are the affected teams told, and why not" />
      <Card>
        <EmptyState icon={BarChart3} title="Coverage, gaps and what to act on first" action={{ label: "Ask the assistant", href: "/" }}>
          How many affected teams were told before the change date, and why the rest were not. The charts are being wired up.
        </EmptyState>
      </Card>
    </>
  );
}
