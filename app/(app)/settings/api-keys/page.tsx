import { PageLoading } from "@/components/states/States";
import { connection } from "next/server";
import { Suspense } from "react";
import { ApiKeysPanel, type KeyRow } from "@/components/settings/ApiKeysPanel";
import { env } from "@/lib/env";
import { getContext } from "@/lib/server/context";

const Notice = ({ children }: { children: React.ReactNode }) => (
  <p role="status" className="max-w-2xl rounded-lg border border-hairline bg-raised px-4 py-3 text-sm text-body">{children}</p>
);

async function Keys() {
  await connection(); // per-request: the viewer differs for every visit
  const ctx = await getContext();
  if (ctx.viewer.kind !== "user")
    return <Notice>API keys let an agent (Claude Code, Cursor) read your org&apos;s graph over MCP as the person who created the key. The public demo has no accounts: its MCP endpoint is anonymous and read-only. Sign in as an org admin to create keys.</Notice>;
  if (ctx.viewer.role !== "admin") return <Notice>Only org admins can manage API keys.</Notice>;
  if (!env().DATABASE_URL) return <Notice>Postgres isn&apos;t configured, so there are no API keys to manage.</Notice>;
  const { listKeys } = await import("@/lib/api-keys");
  const rows: KeyRow[] = (await listKeys(ctx.org.id)).map((k) => ({
    id: k.id, name: k.name, prefix: k.prefix, createdAt: k.createdAt.toISOString(), revoked: !!k.revokedAt, lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
  }));
  return <ApiKeysPanel keys={rows} />;
}

export default function ApiKeysPage() {
  return (
    <div className="space-y-4 p-6">
      <h1 className="text-lg font-medium text-strong">API keys</h1>
      <Suspense fallback={<PageLoading />}><Keys /></Suspense>
    </div>
  );
}
