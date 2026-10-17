import { PageLoading } from "@/components/states/States";
import { Suspense } from "react";
import { ItScreen } from "@/components/it/ItScreen";

export default function ItPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ItScreen />
    </Suspense>
  );
}
