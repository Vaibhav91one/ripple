import { PageLoading } from "@/components/states/States";
import { Suspense } from "react";
import { RunDetailScreen } from "@/components/agents/RunDetailScreen";

async function Run({ params }: { params: Promise<{ id: string }> }) {
  return <RunDetailScreen id={(await params).id} />;
}

export default function RunPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Run params={params} />
    </Suspense>
  );
}
