import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { MembersSection, Notice, PrefsSection } from "@/components/settings/sections";
import { PageLoading } from "@/components/states/States";
import { Card, CardHeader } from "@/components/ui/card";
import { ACTOR_TYPES, auditHref, parseAuditFilter, type AuditFilter } from "@/lib/audit-view";
import { env } from "@/lib/env";
import { me, type Mode } from "@/lib/me";
import { getContext, type Context } from "@/lib/server/context";

type SP = Promise<Record<string, string | string[] | undefined>>;
const link = "inline-flex items-center gap-1 text-sm font-medium text-strong underline-offset-4 hover:underline";
const field = "h-10 min-w-0 flex-1 rounded-control border border-hairline bg-surface px-3 text-sm text-body placeholder:text-faint";

const MODE: Record<Mode, { label: string; line: string }> = {
  demo: { label: "Shared demo", line: "No account and read-only: every write is refused and logged. Self-host in local mode to make changes." },
  local: { label: "Local workspace", line: "One writable workspace on this machine, no accounts (RIPPLE_MODE=local). You act as its admin." },
  clerk: { label: "Signed-in org", line: "Your Clerk organization, with its own graph, members and roles." },
};

function Workspace({ ctx, mode, org }: { ctx: Context; mode: Mode; org: string }) {
  const pg = !!env().DATABASE_URL;
  return (
    <Card className="space-y-4">
      <CardHeader title="Workspace" sub={`${MODE[mode].label} · ${org}`} />
      <p className="text-sm text-body">{MODE[mode].line}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-faint">Graph</dt><dd className="truncate font-mono text-body">{ctx.org.graphName}</dd>
        <dt className="text-faint">Postgres</dt><dd className="text-body">{pg ? "Connected: members, prefs and the audit log are saved" : "Not configured: nothing is saved"}</dd>
      </dl>
      <Link href="/integrations#api-keys" className={link}>API keys live in Integrations <ArrowUpRight size={14} aria-hidden /></Link>
    </Card>
  );
}

async function AgentDefaults({ ctx }: { ctx: Context }) {
  const { listAgents } = await import("@/lib/approvals/service");
  const live = !!env().DATABASE_URL;
  const agents = await listAgents(live ? ctx.org.id : null).catch(() => []);
  const kinds = new Map<string, boolean>();
  for (const a of agents) for (const [k, on] of Object.entries(a.autoApprove)) kinds.set(k, (kinds.get(k) ?? false) || on);
  const auto = [...kinds].filter(([, on]) => on).map(([k]) => k.replaceAll("_", " "));
  const on = agents.filter((a) => a.enabled).length;
  return (
    <Card className="space-y-4">
      <CardHeader title="Agent defaults" sub={`${on} of ${agents.length} agents switched on`} />
      <p className="text-md text-strong">
        {auto.length ? `${auto.length} of ${kinds.size} action kinds run without a person.` : `All ${kinds.size} action kinds wait for a person to approve.`}
      </p>
      <p className="text-sm text-faint">
        {auto.length ? `Auto-approved: ${auto.join(", ")}. Everything else lands in Approvals first.` : "Agents only propose; nothing changes until someone approves it in Approvals."}
        {!live && " Postgres isn't configured, so these are the built-in defaults."}
      </p>
      <Link href="/agents" className={link}>Change per agent in Agents <ArrowUpRight size={14} aria-hidden /></Link>
    </Card>
  );
}

const when = (iso: string) => iso.slice(0, 16).replace("T", " ");

async function AuditLog({ ctx, f }: { ctx: Context; f: AuditFilter }) {
  if (ctx.viewer.kind !== "user") return <Notice>The shared demo keeps its audit log private: it only records refused writes from anonymous visitors. In local mode or a signed-in org, every write and every refusal shows up here.</Notice>;
  if (ctx.viewer.role !== "admin") return <Notice>Only org admins can read the audit log.</Notice>;
  if (!env().DATABASE_URL) return <Notice>Postgres isn&apos;t configured, so nothing is logged.</Notice>;
  const { listAudit } = await import("@/lib/audit-view");
  const { rows, more, actions } = await listAudit(ctx.org.id, f);
  return (
    <div className="space-y-4">
      <form action="/settings#audit" className="flex flex-wrap gap-2" role="search" aria-label="Filter the audit log">
        <input name="actor" defaultValue={f.actor} list="audit-actors" placeholder="Actor: user, agent or an id" aria-label="Actor" className={field} />
        <datalist id="audit-actors">{ACTOR_TYPES.map((a) => <option key={a} value={a} />)}</datalist>
        <input name="action" defaultValue={f.action} list="audit-actions" placeholder="Action, e.g. member." aria-label="Action" className={field} />
        <datalist id="audit-actions">{actions.map((a) => <option key={a} value={a} />)}</datalist>
        <button className="h-10 rounded-control bg-raised px-3.5 text-sm font-medium text-strong hover:bg-hairline">Filter</button>
        {(f.actor || f.action) && <Link href="/settings#audit" className="inline-flex h-10 items-center px-2 text-sm text-faint hover:text-strong">Clear</Link>}
      </form>
      <div className="relative overflow-x-auto rounded-inset border border-hairline">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline text-faint">
            <tr><th className="p-3 font-medium">When (UTC)</th><th className="p-3 font-medium">Actor</th><th className="p-3 font-medium">Action</th><th className="p-3 font-medium">Resource</th><th className="p-3 font-medium">Outcome</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-hairline last:border-0">
                <td className="whitespace-nowrap p-3 font-mono text-xs tabular-nums text-body">{when(r.at)}</td>
                <td className="p-3 text-body">{r.actorType}{r.actorId && <span className="block max-w-40 truncate font-mono text-xs text-faint">{r.actorId}</span>}</td>
                <td className="p-3 font-mono text-xs text-strong">{r.action}</td>
                <td className="max-w-56 truncate p-3 text-body">{r.resource ?? "-"}</td>
                <td className={`p-3 ${r.outcome === "deny" ? "font-medium text-strong" : "text-faint"}`}>{r.outcome === "deny" ? "Refused" : "Allowed"}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="p-6 text-center text-faint">{f.actor || f.action ? "Nothing matches these filters." : "Nothing logged yet."}</td></tr>}
          </tbody>
        </table>
      </div>
      <nav aria-label="Audit log pages" className="flex items-center justify-between text-sm">
        <span className="text-faint">Page {f.page}</span>
        <span className="flex gap-4">
          {f.page > 1 && <Link href={auditHref(f, f.page - 1)} className={link}>Newer</Link>}
          {more && <Link href={auditHref(f, f.page + 1)} className={link}>Older</Link>}
        </span>
      </nav>
    </div>
  );
}

async function Settings({ searchParams }: { searchParams: SP }) {
  await connection(); // per-request: the viewer differs for every visit
  const [ctx, sp] = await Promise.all([getContext(), searchParams]);
  const who = await me(ctx);
  const f = parseAuditFilter(sp);
  return (
    <>
      <PageHeader title="Settings" subtitle={`${MODE[who.mode].label} · ${who.org}. Org-wide choices live here; yours live in your profile.`} />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="grid min-w-0 gap-4">
          <Card className="space-y-4">
            <CardHeader title="Members & roles" sub="Who is in the org, their role, teams and linked person" action={<Link href="/settings/members" className={link}>Open</Link>} />
            <MembersSection ctx={ctx} />
          </Card>
          <section aria-label="Notification defaults" className="space-y-3">
            <PrefsSection ctx={ctx} show="org" />
          </section>
          <Card id="audit" className="space-y-4">
            <CardHeader title="Audit log" sub="Every write and every refused write in this org, newest first. Read-only." />
            <AuditLog ctx={ctx} f={f} />
          </Card>
        </div>
        <div className="grid min-w-0 gap-4 lg:sticky lg:top-6">
          <Workspace ctx={ctx} mode={who.mode} org={who.org} />
          <AgentDefaults ctx={ctx} />
          <Card className="space-y-3">
            <CardHeader title="Your profile" sub={`${who.name} · ${who.role}`} />
            <p className="text-sm text-faint">Your name, team, the demo lens and your own notification choices.</p>
            <Link href="/profile" className={link}>Open profile <ArrowUpRight size={14} aria-hidden /></Link>
          </Card>
        </div>
      </div>
    </>
  );
}

export default function SettingsPage({ searchParams }: { searchParams: SP }) {
  return <Suspense fallback={<PageLoading />}><Settings searchParams={searchParams} /></Suspense>;
}
