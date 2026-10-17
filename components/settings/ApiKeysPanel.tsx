"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type KeyRow = { id: string; name: string; prefix: string; createdAt: string; revoked: boolean; lastUsedAt: string | null };

const field = "rounded-md border border-hairline bg-raised px-2 py-1 text-sm text-body";
const btn = "rounded-md border border-hairline bg-raised px-3 py-1 text-sm text-strong disabled:opacity-50";
const day = (iso: string) => iso.slice(0, 10);

/** Admin panel: create a key (shown once), list prefixes with last use, revoke. */
export function ApiKeysPanel({ keys }: { keys: KeyRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string>();
  const [err, setErr] = useState<string>();
  const call = (method: "POST" | "DELETE", body: object, done?: (j: { key?: string }) => void) =>
    start(async () => {
      const res = await fetch("/api/org/keys", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      setErr(res.ok ? undefined : `Request failed (${res.status})`);
      if (res.ok) done?.(await res.json());
      router.refresh();
    });

  return (
    <div className="max-w-3xl space-y-4" aria-busy={pending}>
      {err && <p role="alert" className="text-sm text-body">{err}</p>}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); call("POST", { name }, (j) => { setFresh(j.key); setName(""); }); }}>
        <input aria-label="Key name" required maxLength={80} placeholder="Key name, e.g. Claude Code laptop" value={name} onChange={(e) => setName(e.target.value)} className={`${field} flex-1`} />
        <button className={btn} disabled={pending || !name.trim()}>Create key</button>
      </form>
      {fresh && (
        <div role="status" className="space-y-2 rounded-lg border border-hairline bg-raised p-4 text-sm text-body">
          <p>Copy this key now. It is shown once and Ripple keeps only its hash. It acts with your teams and role.</p>
          <code className="block break-all rounded-md bg-surface p-2 text-strong">{fresh}</code>
          <button className={btn} onClick={() => setFresh(undefined)}>Done</button>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-hairline bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline text-faint">
            <tr><th className="p-3 font-medium">Name</th><th className="p-3 font-medium">Key</th><th className="p-3 font-medium">Created</th><th className="p-3 font-medium">Last used</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {keys.length === 0 && <tr><td colSpan={5} className="p-3 text-faint">No keys yet.</td></tr>}
            {keys.map((k) => (
              <tr key={k.id} className="border-b border-hairline last:border-0">
                <td className="p-3 text-strong">{k.name}</td>
                <td className="p-3 font-mono text-body">rpl_{k.prefix}_…</td>
                <td className="p-3 text-body">{day(k.createdAt)}</td>
                <td className="p-3 text-body">{k.lastUsedAt ? day(k.lastUsedAt) : "never"}</td>
                <td className="p-3 text-right">
                  {k.revoked ? <span className="text-faint">Revoked</span> : <button className={btn} disabled={pending} onClick={() => call("DELETE", { id: k.id })}>Revoke</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
