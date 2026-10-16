import { Suspense } from "react";
import { InboxScreen } from "@/components/inbox/InboxScreen";

export default function InboxPage() {
  return (
    <Suspense>
      <InboxScreen />
    </Suspense>
  );
}
