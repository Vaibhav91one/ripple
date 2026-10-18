import { Puzzle } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default function IntegrationsPage() {
  return (
    <>
      <PageHeader title="Integrations" subtitle="Use Ripple from Claude Code, Cursor, Codex and Slack" />
      <Card>
        <EmptyState icon={Puzzle} title="Ripple where you already work" action={{ label: "Ask the assistant", href: "/" }}>
          Install snippets for the MCP server and the Claude Code plugin will live here.
        </EmptyState>
      </Card>
    </>
  );
}
