"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Unplug } from "lucide-react";

/** Red "Disconnect" with a native <dialog> confirm. Admin-only on the server too; on success the page refetches its state. */
export function DisconnectButton({ kind, name, accountIds }: { kind: "github" | "slack"; name: string; accountIds: string[] }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const confirm = () =>
    start(async () => {
      setError(undefined);
      for (const accountId of accountIds) {
        const res = await fetch(`/api/connectors/${kind}/disconnect`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accountId }) });
        if (!res.ok) { setError(res.status === 403 ? "Only an org admin can disconnect." : `Could not disconnect (${res.status}).`); return; }
      }
      dialog.current?.close();
      router.refresh();
    });
  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()}
        className="inline-flex h-10 items-center gap-1.5 rounded-control border border-conflict-soft px-3.5 text-sm font-medium text-conflict hover:bg-conflict-soft">
        <Unplug size={14} aria-hidden /> Disconnect
      </button>
      <dialog ref={dialog} aria-labelledby={`dc-${kind}`} className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-card border border-hairline bg-surface p-6 text-body shadow-lg backdrop:bg-strong/30">
        <h2 id={`dc-${kind}`} className="text-lg font-medium text-strong">Disconnect {name}?</h2>
        <p className="mt-2 text-sm text-faint">Ripple stops reading {name} for this org and forgets its stored token. What it already learned stays in the graph. You can connect again at any time.</p>
        {error && <p role="alert" className="mt-3 text-sm text-conflict">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => dialog.current?.close()} className="inline-flex h-10 items-center rounded-control border border-hairline px-3.5 text-sm font-medium text-strong hover:bg-raised">Cancel</button>
          <button type="button" disabled={pending} onClick={confirm} className="inline-flex h-10 items-center rounded-control bg-conflict px-3.5 text-sm font-medium text-ink-on-strong hover:opacity-90 disabled:opacity-50">
            {pending ? "Disconnecting…" : "Disconnect"}
          </button>
        </div>
      </dialog>
    </>
  );
}
