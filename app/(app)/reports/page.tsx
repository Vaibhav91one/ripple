import { Suspense } from "react";
import { ReportsScreen } from "@/components/reports/ReportsScreen";
import { PageSkeleton } from "@/components/ui/skeleton";

export default function ReportsPage() {
  return <Suspense fallback={<PageSkeleton />}><ReportsScreen /></Suspense>;
}
