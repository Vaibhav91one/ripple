import { connection } from "next/server";
import { Suspense } from "react";
import { env } from "@/lib/env";

const MSG: Record<string, string> = {
  denied: "Slack install was cancelled.",
  state: "The install link expired. Try again.",
  install: "Slack install failed. Check the server log.",
};

type Search = Promise<Record<string, string | undefined>>;

async function Status({ searchParams }: { searchParams: Search }) {
  await connection();
  const q = await searchParams;
  const msg = q.connected ? "Slack is connected." : q.error ? MSG[q.error] : undefined;
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
    </div>
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
