"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plug, RefreshCw } from "lucide-react";
import type { CatalogEntry } from "@/lib/connectors";
import type { AccountRow } from "@/lib/connectors/accounts";

const AUTH: Record<CatalogEntry["auth"], string> = { app: "App install", oauth: "OAuth", apikey: "API key", upload: "Upload" };
const STATUS_TONE: Record<string, string> = { active: "bg-ripple-soft text-ripple", error: "bg-conflict-soft text-conflict" };
const when = (iso: string | null) => (iso ? `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC` : "Never");

type Props = { accounts: AccountRow[]; catalog: CatalogEntry[]; ready: string[]; canSync: boolean; note?: string };

/** Connected accounts (kind, status, last sync, scopes, Sync now for admins) above the sources Ripple can plug in. */
export function ConnectorsPanel({ accounts, catalog, ready, canSync, note }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string>();
  const name = (kind: string) => catalog.find((c) => c.kind === kind)?.name ?? kind;
  const syncNow = (a: AccountRow) =>
    start(async () => {
      const res = await fetch(`/api/connectors/${a.kind}/sync`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accountId: a.id }) });
      setMsg(res.ok ? `Sync queued for ${name(a.kind)}.` : `Could not queue the sync (${res.status}).`);
      router.refresh();
    });

  return (
    <div className="max-w-5xl space-y-8" aria-busy={pending}>
      {note && <p role="status" className="rounded-lg border border-hairline bg-raised px-4 py-3 text-sm text-body">{note}</p>}
      {msg && <p role="status" className="text-sm text-body">{msg}</p>}
      <section aria-labelledby="connected" className="space-y-3">
        <h2 id="connected" className="text-sm font-medium text-strong">Connected</h2>
        {accounts.length === 0 ? (
          <p className="rounded-card border border-dashed border-hairline p-6 text-sm text-faint">Nothing connected yet.</p>
        ) : (
          <ul className="divide-y divide-hairline rounded-card border border-hairline bg-surface">
            {accounts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
                <div className="min-w-0 flex-1 basis-48">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-strong">{name(a.kind)}</span>
                    <span className={`inline-flex h-5 items-center rounded-full px-2 text-xs font-medium ${STATUS_TONE[a.status] ?? "bg-overlay text-body"}`}>{a.status}</span>
                  </div>
                  <p className="truncate text-xs text-faint">{a.externalId}</p>
                </div>
                <div className="basis-40 text-sm">
                  <p className="text-xs text-faint">Last sync</p>
                  <p className="text-body">{when(a.lastSyncAt)}</p>
                </div>
                <ul aria-label="Scopes" className="flex min-w-0 basis-56 flex-wrap gap-1.5">
                  {a.scopes.length ? a.scopes.map((s) => <li key={s} className="rounded-md bg-overlay px-1.5 py-0.5 text-xs text-body">{s}</li>) : <li className="text-xs text-faint">No scopes</li>}
                </ul>
                {canSync && (
                  <button type="button" disabled={pending} onClick={() => syncNow(a)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline bg-raised px-3 text-sm text-strong disabled:opacity-50">
                    <RefreshCw size={14} aria-hidden /> Sync now
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="available" className="space-y-3">
        <h2 id="available" className="text-sm font-medium text-strong">Available sources</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.map((c) => (
            <li key={c.kind} className="flex flex-col gap-2 rounded-card border border-hairline bg-surface p-4">
              <div className="flex items-center gap-2">
                <Plug size={14} className="text-faint" aria-hidden />
                <span className="font-medium text-strong">{c.name}</span>
                <span className="ml-auto rounded-full bg-overlay px-2 py-0.5 text-xs text-body">{ready.includes(c.kind) ? "Ready" : "Coming soon"}</span>
              </div>
              <p className="text-sm text-body">{c.blurb}</p>
              <p className="text-xs text-faint">{AUTH[c.auth]}</p>
              {ready.includes(c.kind) && c.auth === "app" && <a href={`/connectors/${c.kind}`} className="text-sm text-ripple underline-offset-2 hover:underline">Set up {c.name}</a>}
              {c.kind === "csv" && <Link href="/connectors/csv" className="text-sm text-ripple underline-offset-4 hover:underline">Import a CSV</Link>}
              {c.kind === "csv" && <Link href="/connectors/upload" className="text-sm text-ripple underline-offset-4 hover:underline">Upload documents</Link>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
