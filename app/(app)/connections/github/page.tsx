import { connection } from "next/server";
import { Suspense } from "react";
import { ConnectionStatus } from "@/components/connectors/ConnectionStatus";
import { loadConnections } from "@/components/connectors/load";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageLoading } from "@/components/states/States";
import { getContext } from "@/lib/server/context";

const MESSAGES: Record<string, string> = {
  bad_state: "The install link expired or belongs to another session. Try Connect GitHub again.",
  not_configured: "The GitHub App is not configured on this server.",
  installation_taken: "That GitHub installation is already connected to another workspace.",
  unverified_installation: "GitHub did not confirm that you control that installation. Try Connect GitHub again.",
  unknown_installation: "GitHub doesn't know that installation for our app.",
  forbidden: "Only an admin of the active organization can connect GitHub. Select an organization, then try again.",
};

async function Github({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  await connection(); // per-request: depends on the viewer
  const { connected, error } = await searchParams;
  const ctx = await getContext();
  const view = await loadConnections(ctx);
  const flash = error ? (MESSAGES[error] ?? "Could not connect GitHub.") : connected ? "GitHub connected. The first sync is queued." : null;
  return (
    <div className="max-w-2xl min-w-0 space-y-4">
      {flash && <p role="status" className="rounded-inset border border-hairline bg-raised px-4 py-3 text-sm text-body">{flash}</p>}
      {view.note && <p role="status" className="rounded-inset border border-hairline bg-surface px-4 py-3 text-sm text-body">{view.note}</p>}
      <ConnectionStatus c={view.conns.github} name="GitHub" connectHref="/api/connectors/github/install" canManage={view.canManage} demo={view.demo} syncable />
      <p className="text-sm text-body">Ripple reads repositories, CODEOWNERS and recent pull requests to learn which systems exist, who owns them and who works on them. It never writes code.</p>
      <details className="text-sm text-faint">
        <summary className="cursor-pointer text-body">Permissions the app asks for</summary>
        <p className="mt-2">Contents (read), metadata (read), pull requests (write, for comments), checks (write), issues (write). Disconnecting here stops Ripple reading; uninstall the app on GitHub to revoke it there too.</p>
      </details>
    </div>
  );
}

export default function GithubConnectorPage(props: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  return (
    <>
      <PageHeader title="GitHub" subtitle="Repos, pull requests and CODEOWNERS ownership." crumbs={[{ label: "Connections", href: "/connections" }, { label: "GitHub" }]} />
      <Suspense fallback={<PageLoading />}><Github searchParams={props.searchParams} /></Suspense>
    </>
  );
}
