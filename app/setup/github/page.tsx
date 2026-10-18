import { connection } from "next/server";
import { headers } from "next/headers";
import { Suspense } from "react";
import { buildManifest } from "@/lib/connectors/github/manifest";
import { makeState } from "@/lib/connectors/github/setup";
import { env } from "@/lib/env";
import { getContext } from "@/lib/server/context";

export const metadata = { title: "Set up the GitHub App" };

const ERRORS: Record<string, string> = {
  bad_state: "That setup link expired or belongs to another session. Start again.",
  conversion_failed: "GitHub did not accept the setup code. Start again.",
};

async function origin() {
  if (env().APP_URL) return env().APP_URL!.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host")?.split(",")[0].trim() ?? h.get("host") ?? "localhost:3000";
  return `${h.get("x-forwarded-proto")?.split(",")[0].trim() ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
}

/** Admins only (local mode counts as admin). The form POSTs the manifest straight to GitHub; no JavaScript needed. */
async function Setup({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await connection(); // per-request: depends on the viewer
  const { error } = await searchParams;
  const ctx = await getContext();
  const v = ctx.viewer;
  const admin = !ctx.readonly && v.kind === "user" && v.role === "admin";
  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 py-16">
      <h1 className="text-xl font-semibold text-strong">Set up the GitHub App</h1>
      {error && <p role="status" className="rounded-lg border border-hairline bg-raised px-4 py-3 text-sm text-body">{ERRORS[error] ?? "Setup failed."}</p>}
      {!admin || v.kind !== "user" ? (
        <p className="text-sm text-body">Only an admin can create the GitHub App. Sign in as an admin, or run Ripple with <code>RIPPLE_MODE=local</code>.</p>
      ) : (
        <>
          <p className="text-sm text-body">Creates a GitHub App for this Ripple server in one click: Ripple answers @mentions with cited impact and posts a &ldquo;Ripple impact&rdquo; check on pull requests. You confirm the app on GitHub, then pick the repositories to install it on.</p>
          <form action={`https://github.com/settings/apps/new?state=${encodeURIComponent(makeState(v.userId))}`} method="post" className="space-y-3">
            <input type="hidden" name="manifest" value={JSON.stringify(buildManifest(await origin()))} />
            <button type="submit" className="rounded-lg border border-hairline bg-raised px-4 py-2 text-sm text-strong hover:bg-overlay">Create the GitHub App</button>
          </form>
          <p className="text-xs text-faint">GitHub must reach this server: set <code>APP_URL</code> to a public URL (see SELF_HOSTING.md).</p>
        </>
      )}
    </main>
  );
}

export default function SetupGithub(props: { searchParams: Promise<{ error?: string }> }) {
  return <Suspense fallback={<main className="mx-auto max-w-xl px-4 py-16 text-sm text-faint">Loading...</main>}><Setup {...props} /></Suspense>;
}
