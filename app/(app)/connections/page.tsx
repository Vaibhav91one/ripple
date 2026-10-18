import { Cable } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default function ConnectionsPage() {
  return (
    <>
      <PageHeader title="Connections" subtitle="The tools Ripple reads to build the company graph" />
      <Card>
        <EmptyState icon={Cable} title="Connect GitHub, Slack, Jira and more" action={{ label: "Open settings", href: "/settings" }}>
          Each source adds people, systems, tickets and contracts to the graph. The connection catalog is being wired up.
        </EmptyState>
      </Card>
    </>
  );
}
