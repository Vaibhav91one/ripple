import { cookies } from "next/headers";
import { Suspense } from "react";
import { Assistant } from "@/components/assistant/Assistant";
import { LENS_COOKIE, parseLens } from "@/lib/lens";
import { getContext } from "@/lib/server/context";

/** Reads the request: the demo lens keys the browser history, and the demo is read-only (approval cards inert). */
async function Viewer() {
  const lens = parseLens((await cookies()).get(LENS_COOKIE)?.value);
  const readonly = await getContext().then((c) => c.readonly || c.org.isDemo, () => true);
  return <Assistant key={lens} lens={lens} readonly={readonly} />;
}

// `/` is the Assistant: the first thing every visitor sees (no login; cached starters work without an LLM key).
export default function AssistantPage() {
  return (
    <Suspense>
      <Viewer />
    </Suspense>
  );
}
