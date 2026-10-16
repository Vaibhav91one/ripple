"use client";

import { useQuery } from "@tanstack/react-query";
import { LiveChange } from "@/components/live/LiveChange";
import { getRipple } from "@/lib/api";

export default function LiveStyleguide() {
  const { data } = useQuery({ queryKey: ["ripple", "d-1"], queryFn: () => getRipple("d-1") });
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 bg-page px-6 py-12">
      <h1 className="text-2xl font-semibold text-strong">Live change</h1>
      {data && <LiveChange result={data} autoRun />}
    </main>
  );
}
