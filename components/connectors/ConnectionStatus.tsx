import { RefreshCw } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { STATE_LABEL, STATE_TONE, type Connection } from "@/lib/connectors/state";
import { DisconnectButton } from "./DisconnectButton";
import { SyncButton } from "./SyncButton";

const BTN = "inline-flex h-10 items-center gap-1.5 rounded-control px-3.5 text-sm font-medium";

/** The pill + account line every connection page shows. Admins get Connect / Reconnect / Disconnect; everyone else reads why they can't. */
export function ConnectionStatus({ c, name, connectHref, canManage, demo, syncable }: { c: Connection; name: string; connectHref: string | null; canManage: boolean; demo: boolean; syncable?: boolean }) {
  const has = c.state !== "none";
  const line = c.state === "connected" ? `Connected to ${c.label ?? name}.` : c.state === "error" ? `The last sync from ${c.label ?? name} failed. Reconnect, or sync again.` : c.state === "needs_reauth" ? `${c.label ?? name} needs to be connected again.` : `${name} isn't connected yet.`;
  return (
    <section aria-label={`${name} connection`} className="min-w-0 space-y-4 rounded-card border border-hairline bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <StatusPill tone={STATE_TONE[c.state]}>{STATE_LABEL[c.state]}</StatusPill>
        {c.label && <span className="min-w-0 truncate text-sm font-medium text-strong">{c.label}</span>}
      </div>
      <p className="text-sm text-body">{line}{c.lastSyncAt && ` Last sync ${c.lastSyncAt.slice(0, 10)}.`}</p>
      {canManage ? (
        <div className="flex flex-wrap items-center gap-2">
          {connectHref && (
            <a href={connectHref} className={has ? `${BTN} border border-hairline text-strong hover:bg-raised` : `${BTN} bg-strong text-ink-on-strong hover:bg-body`}>
              {has && <RefreshCw size={14} aria-hidden />}{has ? "Reconnect" : `Connect ${name}`}
            </a>
          )}
          {has && syncable && c.accountIds[0] && <SyncButton kind={c.kind} accountId={c.accountIds[0]} />}
          {has && <DisconnectButton kind={c.kind} name={c.label ?? name} accountIds={c.accountIds} />}
        </div>
      ) : (
        <p className="text-sm text-faint">{demo ? `The demo can't connect ${name}. Self-host Ripple or sign in to an org to connect it.` : `Ask an org admin to ${has ? "manage" : "connect"} ${name}.`}</p>
      )}
    </section>
  );
}
