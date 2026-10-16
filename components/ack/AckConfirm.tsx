"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { SlideConfirm } from "@/components/kit/bencho/slide-confirm";

/** Slide to acknowledge, then swap to the Confirmed state once the handle has landed. */
const kinds = { Seen: "seen", Concern: "concern", "Not relevant": "not_relevant" } as const;

export function AckConfirm({ token, reply }: { token: string; reply?: string }) {
  const [error, setError] = useState<string | null>(null);
  async function post() {
    try {
      const res = await fetch("/api/ack", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, kind: kinds[reply as keyof typeof kinds] ?? "seen" }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      window.setTimeout(() => setConfirmed(true), 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
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
    <>
    {error && <p role="alert" className="text-sm text-conflict">Could not acknowledge: {error}</p>}
    <SlideConfirm
      width={340}
      label="Slide to acknowledge"
      doneLabel="Acknowledged"
      onConfirm={post}
    />
    </>
  );
}
