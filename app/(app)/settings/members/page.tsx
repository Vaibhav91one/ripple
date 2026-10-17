import { PageLoading } from "@/components/states/States";
import { connection } from "next/server";
import { Suspense } from "react";
import { MembersTable, type MemberRow } from "@/components/settings/MembersTable";
import { env } from "@/lib/env";
import { people, teams } from "@/lib/graph/queries";
import { getContext } from "@/lib/server/context";

const Notice = ({ children }: { children: React.ReactNode }) => (
  <p role="status" className="rounded-lg border border-hairline bg-raised px-4 py-3 text-sm text-body">{children}</p>
);

/** Clerk's name and email per user, best effort (the table still works on bare user ids). */
async function clerkProfiles(orgId: string) {
  const out = new Map<string, { label: string; email?: string }>();
  try {
    const { clerkClient } = await import("@clerk/nextjs/server");
    const { data } = await (await clerkClient()).organizations.getOrganizationMembershipList({ organizationId: orgId, limit: 100 });
    for (const m of data) {
      const u = m.publicUserData;
      if (u) out.set(u.userId, { label: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.identifier, email: u.identifier });
    }
  } catch { /* no Clerk lookup: fall back to ids */ }
  return out;
}

async function Members() {
  await connection(); // per-request: the viewer differs for every visit
  const ctx = await getContext();
  if (ctx.viewer.kind !== "user") return <Notice>Sign in to manage members. The public demo has no accounts.</Notice>;
  if (ctx.viewer.role !== "admin") return <Notice>Only org admins can manage members.</Notice>;
  if (!env().DATABASE_URL) return <Notice>Postgres isn&apos;t configured, so there are no members to manage.</Notice>;
  const { listMembers } = await import("@/lib/members");
  const [list, profiles, t, p] = await Promise.all([
    listMembers(ctx.org.id), clerkProfiles(ctx.org.id), teams(ctx.graph), people(ctx.graph),
  ]);
  const rows: MemberRow[] = list.map((m) => ({ ...m, ...(profiles.get(m.userId) ?? { label: m.userId }) }));
  return <MembersTable members={rows} teams={t.data} people={p.data.map(({ id, name, email }) => ({ id, name, email }))} />;
}

export default function MembersPage() {
  return (
    <div className="space-y-4 p-6">
      <h1 className="text-lg font-medium text-strong">Members</h1>
      <Suspense fallback={<PageLoading />}><Members /></Suspense>
    </div>
  );
}
