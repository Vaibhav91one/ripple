"use client";

import { Suspense, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getRipple } from "@/lib/api";
import { ConflictDetail, type Choice } from "@/components/panels/ConflictDetail";
import { SourcePanel, useSourcePanel } from "@/components/panels/SourcePanel";

// Demo for #9: both panels open by default. Real wiring into the Ripple screen comes later.
function Demo() {
  const { data } = useQuery({ queryKey: ["ripple", "d-1"], queryFn: () => getRipple("d-1") });
  const panel = useSourcePanel();
  const [resolved, setResolved] = useState<Choice | null>(null);
  const first = data?.conflicts[0];

  // open the source panel on the RFC quote when the URL has no ?src (demo only)
  useEffect(() => {
    if (first && !panel.src) panel.open(first.sources[0].artifactId, first.sources[0].quote);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first]);

  return (
    <main className="w-full max-w-[880px] self-start space-y-6 p-8">
      <h1 className="text-xl">Conflict detail and source panel</h1>
      {first && data && (
        <ConflictDetail
          conflict={first}
          arrAtRisk={data.counts.arrAtRisk}
          onResolve={(c) => {
            console.log("onResolve", c);
            setResolved(c);
          }}
        />
      )}
      {resolved && <p role="status" className="rounded-md bg-covered-soft p-3 text-sm text-covered">Resolved: {resolved}</p>}
      <SourcePanel />
    </main>
  );
}

// nuqs reads the URL, so the page needs a Suspense boundary for static prerender.
export default function PanelsDemo() {
  return (
    <Suspense>
      <Demo />
    </Suspense>
  );
}
