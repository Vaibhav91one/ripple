// One answer to "is GitHub / Slack connected for this org?", read per request (never cached: it differs per org and viewer).
// Every page that shows a connection (/connections, its GitHub and Slack pages, /integrations, the sidebar) reads it here.
import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { auditLog, connectorAccounts } from "../db/schema";
import { safeMessage } from "../log";

export type ConnState = "connected" | "error" | "needs_reauth" | "none";
export type LiveKind = "github" | "slack";
export type Connection = { kind: LiveKind; state: ConnState; label: string | null; accountIds: string[]; lastSyncAt: string | null };
export type Imports = { csv: string | null; upload: string | null };
export type Connections = Record<LiveKind, Connection> & { imports: Imports };

export const STATE_LABEL: Record<ConnState, string> = { connected: "Connected", error: "Sync failed", needs_reauth: "Reconnect needed", none: "Not connected" };
export const STATE_TONE = { connected: "covered", error: "conflict", needs_reauth: "gap", none: "neutral" } as const;

export type StateRow = { id: string; kind: string; status: string; label: string | null; lastSyncAt: Date | string | null };

/** Pure: the rows of one kind -> its state. Any active row = connected; else an `error` row = error; else any other row = needs_reauth. */
export function summarize(kind: LiveKind, rows: StateRow[]): Connection {
  const mine = rows.filter((r) => r.kind === kind);
  const active = mine.filter((r) => r.status === "active");
  const state: ConnState = active.length ? "connected" : !mine.length ? "none" : mine.some((r) => r.status === "error") ? "error" : "needs_reauth";
  const shown = active.length ? active : mine;
  const labels = [...new Set(shown.map((r) => r.label).filter((l): l is string => !!l))];
  const syncs = shown.map((r) => (r.lastSyncAt ? new Date(r.lastSyncAt).toISOString() : null)).filter((s): s is string => !!s).sort();
  return { kind, state, label: labels.join(", ") || null, accountIds: shown.map((r) => r.id), lastSyncAt: syncs.at(-1) ?? null };
}

export const NONE: Connections = { github: summarize("github", []), slack: summarize("slack", []), imports: { csv: null, upload: null } };

const within = <T,>(p: Promise<T>, ms = 2500) => Promise.race([p, new Promise<never>((_, no) => setTimeout(() => no(new Error("timeout")), ms))]);

/** GitHub installation id -> the account it is installed on (live; the row stores only the id). */
async function githubLabel(installation: string): Promise<string> {
  try {
    const [{ githubApp }, { githubEnv }] = await Promise.all([import("./github/client"), import("./github/app-creds")]);
    const app = await githubApp(await githubEnv());
    if (app) {
      const r = await within(app.octokit.request("GET /app/installations/{installation_id}", { installation_id: Number(installation) }));
      const acct = r.data.account as { login?: string; name?: string } | null;
      if (acct?.login ?? acct?.name) return (acct.login ?? acct.name)!;
    }
  } catch (e) { console.warn("github installation label failed:", safeMessage(e)); }
  return `Installation ${installation}`;
}

/** Slack team name: stored at install in the row's json `cursor` (Slack has no sync cursor); older rows are backfilled once from auth.test. */
async function slackLabel(id: string, cursor: unknown, tokenEnc: string | null): Promise<string | null> {
  const stored = (cursor as { teamName?: string } | null)?.teamName;
  if (stored || !tokenEnc) return stored ?? null;
  try {
    const [{ decrypt }, { slackClient }] = await Promise.all([import("../crypto"), import("./slack/client")]);
    const r = await within(slackClient(decrypt(tokenEnc)).call<{ team?: string }>("auth.test"));
    if (r.team) await db().update(connectorAccounts).set({ cursor: { teamName: r.team } }).where(eq(connectorAccounts.id, id));
    return r.team ?? null;
  } catch (e) { console.warn("slack team label failed:", safeMessage(e)); return null; }
}

/** The org's GitHub and Slack connections, plus when CSV / documents were last imported. */
export async function connectionState(orgId: string): Promise<Connections> {
  const rows = await db().select({
    id: connectorAccounts.id, kind: connectorAccounts.kind, externalId: connectorAccounts.externalId, status: connectorAccounts.status,
    lastSyncAt: connectorAccounts.lastSyncAt, cursor: connectorAccounts.cursor, tokenEnc: connectorAccounts.tokenEnc,
  }).from(connectorAccounts).where(and(eq(connectorAccounts.orgId, orgId), inArray(connectorAccounts.kind, ["github", "slack"]))).orderBy(desc(connectorAccounts.createdAt));
  const labelled: StateRow[] = await Promise.all(rows.map(async (r) => ({
    id: r.id, kind: r.kind, status: r.status, lastSyncAt: r.lastSyncAt,
    label: r.kind === "github" ? await githubLabel(r.externalId) : await slackLabel(r.id, r.cursor, r.tokenEnc),
  })));
  const last = async (action: string) => {
    const [a] = await db().select({ at: auditLog.at }).from(auditLog)
      .where(and(eq(auditLog.orgId, orgId), eq(auditLog.action, action), eq(auditLog.outcome, "allow"))).orderBy(desc(auditLog.at)).limit(1);
    return a?.at.toISOString() ?? null;
  };
  const [csv, upload] = await Promise.all([last("connector.csv_import"), last("connector.upload")]);
  return { github: summarize("github", labelled), slack: summarize("slack", labelled), imports: { csv, upload } };
}

/** Delete one of the org's GitHub/Slack accounts. Returns false when the org has no such account. */
export async function disconnect(orgId: string, kind: LiveKind, accountId: string): Promise<boolean> {
  const gone = await db().delete(connectorAccounts)
    .where(and(eq(connectorAccounts.id, accountId), eq(connectorAccounts.orgId, orgId), eq(connectorAccounts.kind, kind))).returning({ id: connectorAccounts.id });
  return gone.length > 0;
}
