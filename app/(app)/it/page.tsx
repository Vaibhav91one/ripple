import { Suspense } from "react";
import { ItScreen } from "@/components/it/ItScreen";

export default function ItPage() {
  return (
    <Suspense>
      <ItScreen />
    </Suspense>
  );
}
