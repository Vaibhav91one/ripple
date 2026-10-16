import { Suspense } from "react";
import { OverviewScreen } from "@/components/overview/OverviewScreen";

export default function OverviewPage() {
  return (
    <Suspense>
      <OverviewScreen />
    </Suspense>
  );
}
