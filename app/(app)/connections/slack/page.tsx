import { connection } from "next/server";
import { Suspense } from "react";
import { ConnectionStatus } from "@/components/connectors/ConnectionStatus";
import { loadConnections } from "@/components/connectors/load";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageLoading } from "@/components/states/States";
import { env } from "@/lib/env";
import { getContext, type Context } from "@/lib/server/context";

const MSG: Record<string, string> = {
  denied: "Slack install was cancelled.",
  state: "The install link expired. Try again.",
  install: "Slack install failed. Try again, or ask the person who runs this server to check its log.",
  channel: "That is not a Slack channel id (looks like C0123ABC).",
  forbidden: "Only an admin of the active organization can connect Slack. Select an organization, then try again.",
  not_configured: "Slack isn't set up on this server yet.",
};

type Search = Promise<Record<string, string | undefined>>;

async function Status({ searchParams }: { searchParams: Search }) {
  await connection();
  const q = await searchParams;
  const flash = q.connected ? "Slack is connected." : q.saved ? "Channel saved." : q.error ? (MSG[q.error] ?? "Could not connect Slack.") : undefined;
  const e = env();
  const ready = !!(e.SLACK_CLIENT_ID && e.SLACK_CLIENT_SECRET && e.SLACK_SIGNING_SECRET && e.APP_URL);
  const ctx = await getContext();
  const view = await loadConnections(ctx);
  const slack = view.conns.slack;
  return (
    <div className="max-w-2xl min-w-0 space-y-4">
      {flash && <p role="status" className="rounded-inset border border-hairline bg-raised px-4 py-3 text-sm text-body">{flash}</p>}
      {view.note && <p role="status" className="rounded-inset border border-hairline bg-surface px-4 py-3 text-sm text-body">{view.note}</p>}
      <ConnectionStatus c={slack} name="Slack" connectHref={ready ? "/api/slack/install" : null} canManage={view.canManage} demo={view.demo} />
      {!ready && view.canManage && slack.state === "none" && <p className="text-sm text-faint">Slack isn&apos;t set up on this server yet. See the self-hosting guide (slack-manifest.yaml) to create the app.</p>}
      {slack.state === "connected" && view.canManage && <TeamChannels ctx={ctx} />}
    </div>
  );
}

/** One channel id per team: where "post to the team channel" notifications go. Admins only (the route enforces it). */
async function TeamChannels({ ctx }: { ctx: Context }) {
  const store = await import("@/lib/connectors/slack/store");
  const [{ teams }, set] = await Promise.all([import("@/lib/graph/queries"), store.teamChannels(ctx.org.id)]);
  return (
    <section className="min-w-0 space-y-2">
      <h2 className="text-sm font-medium text-strong">Team channels</h2>
      {(await teams(ctx.graph)).data.map((t) => (
        <form key={t.id} method="post" action="/api/slack/channels" className="flex flex-wrap items-center gap-2 text-sm">
          <input type="hidden" name="teamId" value={t.id} />
          <label htmlFor={`ch-${t.id}`} className="w-40 min-w-0 text-body">{t.name}</label>
          <input id={`ch-${t.id}`} name="channelId" defaultValue={set.get(t.id) ?? ""} placeholder="C0123ABC" className="h-8 min-w-0 rounded-md border border-hairline bg-raised px-2 text-strong" />
          <button className="h-8 rounded-md border border-hairline px-3 text-body">Save</button>
        </form>
      ))}
    </section>
  );
}

export default function SlackConnectorPage({ searchParams }: { searchParams: Search }) {
  return (
    <>
      <PageHeader title="Slack" subtitle="Delivers changes to channels and records who was told." crumbs={[{ label: "Connections", href: "/connections" }, { label: "Slack" }]} />
      <Suspense fallback={<PageLoading />}><Status searchParams={searchParams} /></Suspense>
    </>
  );
}
