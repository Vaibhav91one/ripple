import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { LensSwitcher } from "@/components/shell/LensSwitcher";
import { SoundSetting } from "@/components/settings/SoundToggle";
import { PrefsSection } from "@/components/settings/sections";
import { PageLoading } from "@/components/states/States";
import { Card, CardHeader } from "@/components/ui/card";
import { authEnabled } from "@/lib/auth";
import { teams } from "@/lib/graph/queries";
import { me } from "@/lib/me";
import { getContext } from "@/lib/server/context";

const MODE = { demo: "Shared demo, read-only", local: "Local workspace, no account", clerk: "Signed in" } as const;

/** Clerk's own account screen (email, password, sessions), only when both Clerk keys are set. Never a login form. */
async function ClerkAccount() {
  const { ClerkProvider, UserProfile } = await import("@clerk/nextjs");
  return (
    <Card className="min-w-0 space-y-4">
      <CardHeader title="Account" sub="Managed by Clerk: email, password and active sessions" />
      <div className="min-w-0 max-w-full relative overflow-x-auto">
        <ClerkProvider>
          <UserProfile routing="hash" appearance={{ elements: { rootBox: "w-full max-w-full min-w-0", cardBox: "w-full max-w-full min-w-0 shadow-none", card: "w-full max-w-full min-w-0 shadow-none" } }} />
        </ClerkProvider>
      </div>
    </Card>
  );
}

async function Profile() {
  await connection(); // per-request: the viewer differs for every visit
  const ctx = await getContext();
  const who = await me(ctx);
  const names = await teams(ctx.graph).then((r) => new Map(r.data.map((t) => [t.id, t.name])), () => new Map<string, string>());
  const myTeams = who.teamIds.map((id) => names.get(id) ?? id);
  return (
    <>
      <PageHeader title="Profile" subtitle={`${who.name} · ${who.org}`} crumbs={[{ label: "Settings", href: "/settings" }]} />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-4">
          <Card className="space-y-5">
            <div className="flex items-center gap-4">
              <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-full bg-[conic-gradient(var(--ripple),var(--gap),var(--ripple))] p-[2px]">
                <span className="grid size-full place-items-center rounded-full bg-surface text-md font-medium text-strong">{who.initials}</span>
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-medium text-strong">{who.name}</h2>
                <p className="truncate text-sm text-faint">{who.role} · {who.org}</p>
              </div>
            </div>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
              <dt className="text-faint">Mode</dt><dd className="text-body">{MODE[who.mode]}</dd>
              <dt className="text-faint">Role</dt><dd className="text-body">{who.role}</dd>
              <dt className="text-faint">{myTeams.length > 1 ? "Teams" : "Team"}</dt><dd className="text-body">{myTeams.join(", ") || "Not on a team yet"}</dd>
            </dl>
            {who.mode === "clerk" && <p className="text-sm text-faint">An org admin sets your role and teams in <Link href="/settings/members" className="text-strong underline-offset-4 hover:underline">Members</Link>.</p>}
          </Card>
          {who.lens && (
            <Card className="space-y-4">
              <CardHeader title="View as" sub="Which team you are looking from" />
              <div className="flex flex-wrap items-center gap-2"><LensSwitcher current={who.lens} local={who.mode === "local"} /></div>
              <p className="text-sm text-faint">
                Ripple shows the same graph to everyone but redacts the details a team doesn&apos;t own: Legal sees contract clauses, Sales sees deals, leadership sees counts and totals but never the text. Switch the lens to see what each team sees. It is a cookie on this browser, not an account.
              </p>
            </Card>
          )}
          <Card className="space-y-3">
            <CardHeader title="Org settings" sub="Members, org defaults, agents and the audit log" />
            <Link href="/settings" className="inline-flex items-center gap-1 text-sm font-medium text-strong underline-offset-4 hover:underline">Open settings <ArrowUpRight size={14} aria-hidden /></Link>
          </Card>
        </div>
        <div className="grid min-w-0 gap-4">
          <Card className="space-y-3">
            <CardHeader title="Sounds" sub="Subtle cues when things change" />
            <SoundSetting />
          </Card>
          <PrefsSection ctx={ctx} show="me" />
          {authEnabled() && <ClerkAccount />}
        </div>
      </div>
    </>
  );
}

export default function ProfilePage() {
  return <Suspense fallback={<PageLoading />}><Profile /></Suspense>;
}
