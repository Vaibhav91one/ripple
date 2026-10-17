import { connection } from "next/server";
import { Suspense } from "react";
import { ConnectorsPanel } from "@/components/connectors/ConnectorsPanel";
import { CATALOG, CONNECTORS } from "@/lib/connectors";
import type { AccountRow } from "@/lib/connectors/accounts";
import { env } from "@/lib/env";
import { safeMessage } from "@/lib/log";
import { getContext } from "@/lib/server/context";

async function Connectors() {
  await connection(); // per-request: the viewer differs for every visit
  const ctx = await getContext();
  let accounts: AccountRow[] = [];
  let note: string | undefined;
  if (!env().DATABASE_URL) note = "Postgres isn't configured, so no accounts can be connected.";
  else {
    try {
      accounts = await (await import("@/lib/connectors/accounts")).listAccounts(ctx.org.id);
    } catch (e) {
      console.error("connector list failed:", safeMessage(e));
      note = "Connected accounts could not be loaded.";
    }
  }
  if (ctx.readonly) note = "This is the shared demo. Sign in to connect your own sources.";
  const canSync = ctx.viewer.kind === "user" && ctx.viewer.role === "admin";
  return <ConnectorsPanel accounts={accounts} catalog={CATALOG} ready={Object.keys(CONNECTORS)} canSync={canSync} note={note} />;
}

export default function ConnectorsPage() {
  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-lg font-medium text-strong">Connectors</h1>
        <p className="text-sm text-faint">Every source plugs in the same way: authenticate, sync, receive webhooks, propose graph changes.</p>
      </div>
      <Suspense><Connectors /></Suspense>
    </div>
  );
}
