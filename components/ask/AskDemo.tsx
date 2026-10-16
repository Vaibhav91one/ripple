"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect } from "react";
import { AskDrawer, SUGGESTIONS } from "@/components/ask/AskDrawer";

// Demo: drawer open over a plain background, first suggestion auto-submitted.
export function AskDemo() {
  const [, setAsk] = useQueryState("ask", parseAsStringLiteral(["1"] as const));
  useEffect(() => {
    void setAsk("1");
  }, [setAsk]);
  return (
    <main className="min-h-screen bg-page p-8">
      <h1 className="text-[18px] text-strong">Ask drawer</h1>
      <p className="text-[13px] text-faint">Close it and reopen with ?ask=1.</p>
      <AskDrawer autoAsk={SUGGESTIONS[0]} />
    </main>
  );
}
