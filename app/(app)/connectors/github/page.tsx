import { PageLoading } from "@/components/states/States";
import { connection } from "next/server";
import { Suspense } from "react";
import { env } from "@/lib/env";
import { safeMessage } from "@/lib/log";
import { getContext } from "@/lib/server/context";

const MESSAGES: Record<string, string> = {
  bad_state: "The install link expired or belongs to another session. Try Connect GitHub again.",
  not_configured: "The GitHub App is not configured on this server.",
  unknown_installation: "GitHub doesn't know that installation for our app.",
};

async function Github({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  await connection(); // per-request: depends on the viewer
  const { connected, error } = await searchParams;
  const ctx = await getContext();
  const canConnect = !ctx.readonly && ctx.viewer.kind === "user" && ctx.viewer.role === "admin";
  let count = 0;
  if (env().DATABASE_URL) {
    try {
      count = (await (await import("@/lib/connectors/accounts")).listAccounts(ctx.org.id)).filter((a) => a.kind === "github").length;
    } catch (e) {
      console.error("github account list failed:", safeMessage(e));
    }
  }
  const note = error ? (MESSAGES[error] ?? "Could not connect GitHub.") : connected ? "GitHub connected. The first sync is queued." : null;
  return (
    <div className="max-w-xl space-y-4">
      {note && <p role="status" className="rounded-lg border border-hairline bg-raised px-4 py-3 text-sm text-body">{note}</p>}
      <p className="text-sm text-body">
        Ripple reads repositories, CODEOWNERS and recent pull requests to learn which systems exist, who owns them and who works on them.
        It never writes code. Permissions: contents (read), metadata (read), pull requests (write, for comments), checks (write), issues (write).
      </p>
      <p className="text-sm text-faint">{count ? `${count} installation${count > 1 ? "s" : ""} connected.` : "Nothing connected yet."}</p>
      {canConnect ? (
        <a href="/api/connectors/github/install" className="inline-flex h-9 items-center rounded-md bg-ripple px-4 text-sm font-medium text-page">Connect GitHub</a>
      ) : (
        <p className="text-sm text-faint">Only an admin of a signed-in org can connect GitHub.</p>
      )}
    </div>
  );
}

export default function GithubConnectorPage(props: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-lg font-medium text-strong">GitHub</h1>
        <p className="text-sm text-faint">Repos, pull requests and CODEOWNERS ownership.</p>
      </div>
      <Suspense fallback={<PageLoading />}><Github searchParams={props.searchParams} /></Suspense>
    </div>
  );
}
