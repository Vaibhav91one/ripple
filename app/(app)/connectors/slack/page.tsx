import { connection } from "next/server";
import { Suspense } from "react";
import { env } from "@/lib/env";
import { getContext } from "@/lib/server/context";

const MSG: Record<string, string> = {
  denied: "Slack install was cancelled.",
  state: "The install link expired. Try again.",
  install: "Slack install failed. Check the server log.",
  channel: "That is not a Slack channel id (looks like C0123ABC).",
};

type Search = Promise<Record<string, string | undefined>>;

async function Status({ searchParams }: { searchParams: Search }) {
  await connection();
  const q = await searchParams;
  const msg = q.connected ? "Slack is connected." : q.saved ? "Channel saved." : q.error ? MSG[q.error] : undefined;
  const e = env();
  const ready = !!(e.SLACK_CLIENT_ID && e.SLACK_CLIENT_SECRET && e.SLACK_SIGNING_SECRET && e.APP_URL);
  return (
    <div className="max-w-xl space-y-4">
      {msg && <p role="status" className="rounded-lg border border-hairline bg-raised px-4 py-3 text-sm text-body">{msg}</p>}
      {ready ? (
        <a href="/api/slack/install" className="inline-flex h-9 items-center rounded-md bg-ripple px-4 text-sm font-medium text-strong">Connect Slack</a>
      ) : (
        <p className="text-sm text-faint">Slack isn&apos;t configured. Create the app from slack-manifest.yaml, then set SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, SLACK_SIGNING_SECRET and APP_URL.</p>
      )}
      <TeamChannels />
    </div>
  );
}

/** One channel id per team: where "post to the team channel" notifications go. Admins only (the route enforces it). */
async function TeamChannels() {
  const ctx = await getContext();
  if (ctx.readonly || ctx.viewer.kind !== "user" || ctx.viewer.role !== "admin" || !env().DATABASE_URL) return null;
  const store = await import("@/lib/connectors/slack/store");
  if (!(await store.slackToken(ctx.org.id))) return null;
  const [{ teams }, set] = await Promise.all([import("@/lib/graph/queries"), store.teamChannels(ctx.org.id)]);
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-strong">Team channels</h2>
      {(await teams(ctx.graph)).data.map((t) => (
        <form key={t.id} method="post" action="/api/slack/channels" className="flex items-center gap-2 text-sm">
          <input type="hidden" name="teamId" value={t.id} />
          <label htmlFor={`ch-${t.id}`} className="w-40 text-body">{t.name}</label>
          <input id={`ch-${t.id}`} name="channelId" defaultValue={set.get(t.id) ?? ""} placeholder="C0123ABC" className="h-8 rounded-md border border-hairline bg-raised px-2 text-strong" />
          <button className="h-8 rounded-md border border-hairline px-3 text-body">Save</button>
        </form>
      ))}
    </section>
  );
}

export default function SlackConnectorPage({ searchParams }: { searchParams: Search }) {
  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-lg font-medium text-strong">Slack</h1>
        <p className="text-sm text-faint">Delivers changes to channels and records who was told. Admins only.</p>
      </div>
      <Suspense><Status searchParams={searchParams} /></Suspense>
    </div>
  );
}
