import { Suspense } from "react";
import { ApprovalsScreen } from "@/components/approvals/ApprovalsScreen";

export default function ApprovalsPage() {
  return (
    <Suspense>
      <ApprovalsScreen />
    </Suspense>
  );
}
