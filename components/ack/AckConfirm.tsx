"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { SlideConfirm } from "@/components/kit/bencho/slide-confirm";

/** Slide to acknowledge, then swap to the Confirmed state once the handle has landed. */
export function AckConfirm({ reply }: { reply?: string }) {
  const [confirmed, setConfirmed] = useState(false);
  if (confirmed)
    return (
      <div role="status" className="flex items-center gap-3 rounded-lg border border-hairline bg-covered-soft p-4 text-covered">
        <Check className="size-5" aria-hidden />
        <div>
          <p className="font-medium">Confirmed</p>
          <p className="text-xs text-body">Your team is now covered for this decision{reply ? ` (${reply})` : ""}.</p>
        </div>
      </div>
    );
  return (
    <SlideConfirm
      width={340}
      label="Slide to acknowledge"
      doneLabel="Acknowledged"
      onConfirm={() => window.setTimeout(() => setConfirmed(true), 900)}
    />
  );
}
