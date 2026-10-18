// Server sections shared by /settings, /profile and the /settings/* sub-pages. Each one reads the request (wrap in <Suspense>).
import { MembersTable, type MemberRow } from "@/components/settings/MembersTable";
import { NotificationPrefs, type FormValues } from "@/components/settings/NotificationPrefs";
import { env } from "@/lib/env";
import { people, teams } from "@/lib/graph/queries";
import type { Layer } from "@/lib/notify/prefs";
import type { Context } from "@/lib/server/context";

export const Notice = ({ children }: { children: React.ReactNode }) => (
  <p role="status" className="rounded-inset bg-raised/60 px-4 py-3 text-sm text-body">{children}</p>
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

export async function MembersSection({ ctx }: { ctx: Context }) {
  if (ctx.viewer.kind !== "user") return <Notice>The shared demo has no accounts, so there is no one to manage. Self-host in local mode or add Clerk keys to invite people and give them roles and teams.</Notice>;
  if (ctx.viewer.role !== "admin") return <Notice>Only org admins can manage members.</Notice>;
  if (!env().DATABASE_URL) return <Notice>Postgres isn&apos;t configured, so there are no members to manage.</Notice>;
  const { listMembers } = await import("@/lib/members");
  const [list, profiles, t, p] = await Promise.all([listMembers(ctx.org.id), clerkProfiles(ctx.org.id), teams(ctx.graph), people(ctx.graph)]);
  const rows: MemberRow[] = list.map((m) => ({ ...m, ...(profiles.get(m.userId) ?? { label: m.userId }) }));
  return <MembersTable members={rows} teams={t.data} people={p.data.map(({ id, name, email }) => ({ id, name, email }))} />;
}

/** Start == end is how a person switches off org quiet hours, so it reads as "off" here. */
export const toForm = (l: Layer): FormValues => {
  const quiet = !!l.quietStart && !!l.quietEnd && l.quietStart !== l.quietEnd;
  return {
    channels: { high: l.channels?.high ?? [], normal: l.channels?.normal ?? [], low: l.channels?.low ?? [] },
    tz: l.tz ?? "UTC",
    quiet,
    quietStart: quiet ? l.quietStart! : "22:00",
    quietEnd: quiet ? l.quietEnd! : "07:00",
    digest: l.digest ?? (l.digestDay ? l.digestDay !== "off" : true),
    digestDay: l.digestDay && l.digestDay !== "off" ? l.digestDay : "mon",
  };
};

/** `me`: your own preferences; `org`: the org defaults (editable by admins); `both`: the /settings/notifications page. Read-only in the demo. */
export async function PrefsSection({ ctx, show }: { ctx: Context; show: "me" | "org" | "both" }) {
  const zones = Intl.supportedValuesOf("timeZone");
  if (ctx.viewer.kind !== "user") {
    const { SYSTEM_DEFAULTS } = await import("@/lib/notify/prefs");
    return (
      <NotificationPrefs title={show === "org" ? "Notification defaults" : "Your notifications"} initial={toForm(SYSTEM_DEFAULTS)} zones={zones} scope={show === "org" ? "org" : "me"} readOnly
        note="Read-only in the shared demo: it has no accounts, so nothing is saved. These are the defaults everyone starts from; in local mode or a signed-in org you pick your own and admins set the org defaults." />
    );
  }
  if (!env().DATABASE_URL) return <Notice>Postgres isn&apos;t configured, so preferences can&apos;t be saved.</Notice>;
  const { effective, loadOrgDefault, loadPersonLayer } = await import("@/lib/notify/prefs");
  const [mine, org] = await Promise.all([loadPersonLayer(ctx.org.id, ctx.viewer.userId), loadOrgDefault(ctx.org.id)]);
  const admin = ctx.viewer.role === "admin";
  return (
    <div className="space-y-4">
      {show !== "org" && !ctx.viewer.personId && <Notice>Your account isn&apos;t linked to a person yet, so these choices won&apos;t apply until an admin links you in Members.</Notice>}
      {show !== "org" && <NotificationPrefs title="Your notifications" note="Only you. Anything you leave alone follows the org defaults." initial={toForm(effective(mine, org))} zones={zones} scope="me" />}
      {show !== "me" && (
        <NotificationPrefs title="Notification defaults" note={admin ? "Used for anyone who hasn't chosen their own." : "Only org admins can change these."}
          initial={toForm({ ...org, digestDay: org?.digestDay ?? "mon" })} zones={zones} scope="org" readOnly={!admin} />
      )}
    </div>
  );
}
