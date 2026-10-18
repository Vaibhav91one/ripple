import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowRight, FileSpreadsheet, FileText } from "lucide-react";
import { BrandIcon, type BrandName } from "@/components/brand/BrandIcon";
import { SyncButton } from "@/components/connectors/SyncButton";
import { PageHeader, PrimaryButton } from "@/components/shell/PageHeader";
import { PageLoading } from "@/components/states/States";
import { StatusPill } from "@/components/ui/status-pill";
import type { AccountRow } from "@/lib/connectors/accounts";
import { env } from "@/lib/env";
import { safeMessage } from "@/lib/log";
import { getContext } from "@/lib/server/context";

type Source = { kind: string; name: string; reads: string; icon: BrandName | typeof FileText; href?: string; action?: string };

// What Ripple reads. `href` = a live setup flow; without it the source is "Coming soon".
const SOURCES: Source[] = [
  { kind: "github", name: "GitHub", icon: "github", href: "/connections/github", action: "Connect GitHub", reads: "Ripple reads repositories, CODEOWNERS and pull requests to learn which systems exist and who owns them." },
  { kind: "slack", name: "Slack", icon: "slack", href: "/connections/slack", action: "Connect Slack", reads: "Ripple reads the channels it is invited to for decisions, and records who was told." },
  { kind: "csv", name: "CSV import", icon: FileSpreadsheet, href: "/connections/csv", action: "Import a CSV", reads: "Ripple reads customers, deals, usage and who has access to which software from a spreadsheet." },
  { kind: "upload", name: "Document upload", icon: FileText, href: "/connections/upload", action: "Upload documents", reads: "Ripple reads RFCs, policies and contracts, and turns contracts into structured clauses." },
  { kind: "linear", name: "Linear", icon: "linear", reads: "Ripple will read issues, projects and their owners." },
  { kind: "jira", name: "Jira", icon: "jira", reads: "Ripple will read epics and tickets that a change touches." },
  { kind: "notion", name: "Notion", icon: "notion", reads: "Ripple will read RFCs and decision docs where they are written." },
  { kind: "googledrive", name: "Google Drive", icon: "googledrive", reads: "Ripple will read contracts and policies kept in shared drives." },
  { kind: "hubspot", name: "HubSpot", icon: "hubspot", reads: "Ripple will read deals and customer accounts at risk." },
  { kind: "zendesk", name: "Zendesk", icon: "zendesk", reads: "Ripple will read support tickets and escalations." },
];

function SourceIcon({ icon }: { icon: Source["icon"] }) {
  const Icon = icon;
  return (
    <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-inset border border-hairline bg-surface text-strong">
      {typeof Icon === "string" ? <BrandIcon name={Icon} size={22} /> : <Icon size={20} className="text-body" />}
    </span>
  );
}

async function Catalog() {
  await connection(); // per-request: the viewer differs for every visit
  const ctx = await getContext();
  let accounts: AccountRow[] = [];
  let note: string | undefined;
  if (env().DATABASE_URL) {
    try {
      accounts = await (await import("@/lib/connectors/accounts")).listAccounts(ctx.org.id);
    } catch (e) {
      console.error("connector list failed:", safeMessage(e));
      note = "Connected accounts could not be loaded.";
    }
  } else note = "Postgres isn't configured, so no accounts can be connected.";
  if (ctx.readonly) note = "This is the shared demo. Its graph is seeded, so nothing is connected here; self-host Ripple to connect your own sources.";
  const canSync = ctx.viewer.kind === "user" && ctx.viewer.role === "admin";
  const live = SOURCES.filter((s) => s.href).length;
  const connected = SOURCES.filter((s) => accounts.some((a) => a.kind === s.kind));

  return (
    <>
      <PageHeader title="Connections" subtitle={`${connected.length} of ${live} sources connected. Each one adds people, systems, tickets or contracts to the company graph.`}>
        <PrimaryButton href="/integrations">Where Ripple shows up <ArrowRight size={15} aria-hidden /></PrimaryButton>
      </PageHeader>
      {note && <p role="status" className="mb-4 rounded-inset border border-hairline bg-surface px-4 py-3 text-sm text-body">{note}</p>}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SOURCES.map((s) => {
          const account = accounts.find((a) => a.kind === s.kind);
          return (
            <li key={s.kind} className="flex flex-col gap-4 rounded-card border border-hairline bg-surface p-6">
              <div className="flex items-start justify-between gap-3">
                <SourceIcon icon={s.icon} />
                {account ? <StatusPill tone="covered">Connected</StatusPill> : s.href ? <StatusPill tone="neutral">Not connected</StatusPill> : <StatusPill tone="neutral">Coming soon</StatusPill>}
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-medium leading-6 text-strong">{s.name}</h2>
                <p className="mt-1 text-sm text-faint">{s.reads}</p>
                {account?.lastSyncAt && <p className="mt-2 text-xs text-faint">Last sync {account.lastSyncAt.slice(0, 10)}</p>}
              </div>
              {s.href && (
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={s.href} className="inline-flex h-10 items-center gap-1.5 rounded-control border border-hairline bg-surface px-3.5 text-sm font-medium text-strong hover:bg-raised">
                    {account ? "Manage" : s.action} <ArrowRight size={14} aria-hidden className="text-faint" />
                  </Link>
                  {account && canSync && <SyncButton kind={account.kind} accountId={account.id} />}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

export default function ConnectionsPage() {
  return <Suspense fallback={<PageLoading />}><Catalog /></Suspense>;
}
