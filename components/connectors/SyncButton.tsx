"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

/** Admin "Sync now" for one connected account. */
export function SyncButton({ kind, accountId }: { kind: string; accountId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string>();
  const sync = () =>
    start(async () => {
      const res = await fetch(`/api/connectors/${kind}/sync`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accountId }) });
      setMsg(res.ok ? "Sync queued." : `Could not queue the sync (${res.status}).`);
      router.refresh();
    });
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" disabled={pending} onClick={sync}
        className="inline-flex h-9 items-center gap-1.5 rounded-control px-3 text-sm font-medium text-body hover:bg-raised disabled:opacity-50">
        <RefreshCw size={14} aria-hidden /> Sync now
      </button>
      {msg && <span role="status" className="text-xs text-faint">{msg}</span>}
    </span>
  );
}
