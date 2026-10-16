import { Suspense } from "react";
import { AskDemo } from "@/components/ask/AskDemo";

export default function Page() {
  return (
    <Suspense>
      <AskDemo />
    </Suspense>
  );
}
