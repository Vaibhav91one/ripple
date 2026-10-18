"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/** The old Ask drawer (`?ask=1`, ⌘K) is retired: any page with `?ask` lands on the Assistant at `/`. */
export function AskRedirect() {
  const ask = useSearchParams().get("ask");
  const router = useRouter();
  useEffect(() => {
    if (ask !== null) router.replace("/");
  }, [ask, router]);
  return null;
}
