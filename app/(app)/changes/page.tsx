import { Suspense } from "react";
import { ChangesScreen } from "@/components/changes/ChangesScreen";

export default function ChangesPage() {
  return (
    <Suspense>
      <ChangesScreen />
    </Suspense>
  );
}
