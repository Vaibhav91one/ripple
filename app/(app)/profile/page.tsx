import { UserRound } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default function ProfilePage() {
  return (
    <>
      <PageHeader title="Profile" subtitle="Demo visitor · Ledgerly" />
      <Card>
        <EmptyState icon={UserRound} title="You are exploring the shared demo" action={{ label: "Open settings", href: "/settings" }}>
          No account needed. Your name, team and notification preferences will live here.
        </EmptyState>
      </Card>
    </>
  );
}
