import { PageLoading } from "@/components/states/States";
import { Suspense } from "react";
import { OverviewScreen } from "@/components/overview/OverviewScreen";

export default function OverviewPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <OverviewScreen />
    </Suspense>
  );
}
