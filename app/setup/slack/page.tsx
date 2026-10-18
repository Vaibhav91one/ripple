import { connection } from "next/server";
import Link from "next/link";
import { headers } from "next/headers";
import { Suspense } from "react";
import { env } from "@/lib/env";
import { slackManifest } from "@/lib/connectors/slack/manifest";

export const metadata = { title: "Set up the Slack app" };

async function origin() {
  if (env().APP_URL) return env().APP_URL!.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host")?.split(",")[0].trim() ?? h.get("host") ?? "localhost:3000";
  return `${h.get("x-forwarded-proto")?.split(",")[0].trim() ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
}

const STEPS = [
  <>Open <a className="underline" href="https://api.slack.com/apps?new_app=1">api.slack.com/apps</a>, choose <b>Create New App</b>, then <b>From a manifest</b>, and pick your workspace.</>,
  <>Paste the manifest below (or download it) and create the app. Slack needs a public <code>https</code> URL; on localhost use a tunnel and set <code>APP_URL</code> (see SELF_HOSTING.md).</>,
  <>Under <b>Basic Information</b> copy the Client ID, Client Secret and Signing Secret into <code>SLACK_CLIENT_ID</code>, <code>SLACK_CLIENT_SECRET</code> and <code>SLACK_SIGNING_SECRET</code>, then restart Ripple.</>,
  <>Install it from Ripple (<Link className="underline" href="/connectors">Connectors</Link>). Then mention <code>@Ripple</code> in a channel (invite it first with <code>/invite @Ripple</code>) or message it directly.</>,
];

async function Setup() {
  await connection(); // the URL depends on the request host
  const base = await origin();
  const yaml = slackManifest(base);
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-16">
      <h1 className="text-xl font-semibold text-strong">Set up the Slack app</h1>
      <p className="text-sm text-body">Ripple replies to <code>@Ripple</code> mentions and direct messages in a thread, with sources. The manifest below points at <code data-testid="slack-origin">{base}</code>.</p>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-body">{STEPS.map((s, i) => <li key={i}>{s}</li>)}</ol>
      <div className="flex gap-2">
        <a download="slack-manifest.yaml" href={`data:text/yaml;charset=utf-8,${encodeURIComponent(yaml)}`} className="rounded-lg border border-hairline bg-raised px-4 py-2 text-sm text-strong hover:bg-overlay">Download manifest</a>
      </div>
      <pre className="max-h-[28rem] overflow-auto rounded-lg border border-hairline bg-raised p-4 text-xs text-body select-all" data-testid="slack-manifest">{yaml}</pre>
      <p className="text-xs text-faint">Select the text above to copy it. It has no secrets.</p>
    </main>
  );
}

export default function SetupSlack() {
  return <Suspense fallback={<main className="mx-auto max-w-2xl px-4 py-16 text-sm text-faint">Loading...</main>}><Setup /></Suspense>;
}
