import { PageLoading } from "@/components/states/States";
import { connection } from "next/server";
import { Suspense } from "react";
import { NotificationPrefs, type FormValues } from "@/components/settings/NotificationPrefs";
import { env } from "@/lib/env";
import type { Layer } from "@/lib/notify/prefs";
import { getContext } from "@/lib/server/context";

const Notice = ({ children }: { children: React.ReactNode }) => (
  <p role="status" className="rounded-lg border border-hairline bg-raised px-4 py-3 text-sm text-body">{children}</p>
);

/** Start == end is how a person switches off org quiet hours, so it reads as "off" here. */
const toForm = (l: Layer): FormValues => {
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

async function Prefs() {
  await connection(); // per-request: the viewer differs for every visit
  const ctx = await getContext();
  const zones = Intl.supportedValuesOf("timeZone");
  if (ctx.viewer.kind !== "user") {
    const { SYSTEM_DEFAULTS } = await import("@/lib/notify/prefs");
    return (
      <div className="max-w-2xl space-y-3">
        <Notice>The public demo has no accounts, so these are read-only. Everyone starts from the defaults below; sign in to choose how you hear about changes, and admins set the org defaults.</Notice>
        <NotificationPrefs title="Defaults everyone starts from" initial={toForm(SYSTEM_DEFAULTS)} zones={zones} scope="me" readOnly />
      </div>
    );
  }
  if (!env().DATABASE_URL) return <Notice>Postgres isn&apos;t configured, so preferences can&apos;t be saved.</Notice>;
  const { effective, loadOrgDefault, loadPersonLayer } = await import("@/lib/notify/prefs");
  const [mine, org] = await Promise.all([loadPersonLayer(ctx.org.id, ctx.viewer.userId), loadOrgDefault(ctx.org.id)]);
  return (
    <div className="max-w-2xl space-y-6">
      {!ctx.viewer.personId && <Notice>Your account isn&apos;t linked to a person yet, so these choices won&apos;t apply until an admin links you in Members.</Notice>}
      <NotificationPrefs title="Your preferences" initial={toForm(effective(mine, org))} zones={zones} scope="me" />
      {ctx.viewer.role === "admin" && (
        <NotificationPrefs title="Organization defaults" note="Used for anyone who hasn't chosen their own." initial={toForm({ ...org, digestDay: org?.digestDay ?? "mon" })} zones={zones} scope="org" />
      )}
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <div className="space-y-4 p-6">
      <h1 className="text-lg font-medium text-strong">Notifications</h1>
      <Suspense fallback={<PageLoading />}><Prefs /></Suspense>
    </div>
  );
}
