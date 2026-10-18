import { LifeBuoy } from "lucide-react";
import { SiteCredits } from "@/components/SiteCredits";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default function HelpPage() {
  return (
    <>
      <PageHeader title="Help" />
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <EmptyState icon={LifeBuoy} title="Ask Ripple anything about a change" action={{ label: "Open the assistant", href: "/" }}>
            Try “What breaks if we sunset API v1?” or “Who hasn&apos;t been told about the price change?”
          </EmptyState>
        </Card>
        <Card>
          <CardHeader title="Credits" sub="Open-source component kits this app is built with" />
          <SiteCredits className="mt-4 text-sm leading-relaxed" />
        </Card>
      </div>
    </>
  );
}
