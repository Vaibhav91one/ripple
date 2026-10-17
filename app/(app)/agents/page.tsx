import { PageLoading } from "@/components/states/States";
import { Suspense } from "react";
import { AgentsScreen } from "@/components/agents/AgentsScreen";

export default function AgentsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <AgentsScreen />
    </Suspense>
  );
}
