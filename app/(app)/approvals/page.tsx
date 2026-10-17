import { PageLoading } from "@/components/states/States";
import { Suspense } from "react";
import { ApprovalsScreen } from "@/components/approvals/ApprovalsScreen";

export default function ApprovalsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ApprovalsScreen />
    </Suspense>
  );
}
