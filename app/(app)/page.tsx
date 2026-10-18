import { Suspense } from "react";
import { Assistant } from "@/components/assistant/Assistant";

// `/` is the Assistant: the first thing every visitor sees (no login; cached starters work without an LLM key).
export default function AssistantPage() {
  return (
    <Suspense>
      <Assistant />
    </Suspense>
  );
}
