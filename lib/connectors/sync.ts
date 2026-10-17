// Run one connector account: sync from the stored cursor, map records, apply proposals. The cursor is saved after every page.
import { eq } from "drizzle-orm";
import { db } from "../db";
import { connectorAccounts, orgs } from "../db/schema";
import { audit } from "../audit";
import { decrypt } from "../crypto";
import { graphFor, type Graph } from "../graph/client";
import { propose } from "../actions/propose";
import { applyProposal } from "./apply";
import { GraphProposal, type Account, type Connector } from "./define";
import { CONNECTORS } from "./index";

/** `graph` and `connector` are test seams. Throws when the sync fails (pg-boss retries; the next run resumes at the saved cursor). */
export async function runSync(accountId: string, seam: { graph?: Graph; connector?: Connector } = {}): Promise<{ pages: number; applied: number; proposed: number; skipped: number }> {
  const d = db();
  const [row] = await d.select().from(connectorAccounts).where(eq(connectorAccounts.id, accountId));
  if (!row) throw new Error(`unknown connector account ${accountId}`);
  const c = seam.connector ?? CONNECTORS[row.kind];
  if (!c?.sync) throw new Error(`connector ${row.kind} cannot sync`);
  const acct: Account = { id: row.id, orgId: row.orgId, kind: row.kind, externalId: row.externalId, token: row.tokenEnc ? decrypt(row.tokenEnc) : null, scopes: row.scopes };
  const ctx = { org: { id: row.orgId }, viewer: { kind: "system" } };
  const g = seam.graph ?? (await graphFor((await d.select().from(orgs).where(eq(orgs.id, row.orgId)))[0].graphName));
  const out = { pages: 0, applied: 0, proposed: 0, skipped: 0 };
  try {
    for await (const page of c.sync(acct, row.cursor ?? null)) {
      for (const record of page.records) {
        for (const raw of c.map(record, { acct })) {
          const p = GraphProposal.parse(raw);
          if (p.structured) {
            const r = await applyProposal(g, p, Math.floor(Date.now() / 1000));
            if (!r.applied) { out.skipped++; continue; } // endpoint not there yet: counted and logged once below
            await audit(ctx, { action: "connector.graph_write", resourceType: "connector_account", resourceId: row.id, meta: { op: p.op, src: p.src, kind: row.kind } });
            out.applied++;
          } else {
            await propose(ctx, "graph_merge", p, [{ src: p.src, quote: p.quote, confidence: p.confidence }]);
            out.proposed++;
          }
        }
      }
      await d.update(connectorAccounts).set({ cursor: page.nextCursor ?? null, lastSyncAt: new Date(), status: "active" }).where(eq(connectorAccounts.id, row.id));
      out.pages++;
    }
  } catch (e) {
    await d.update(connectorAccounts).set({ status: "error" }).where(eq(connectorAccounts.id, row.id));
    throw e;
  }
  if (out.skipped) console.warn(`[sync] ${row.kind} ${row.id}: skipped ${out.skipped} edge(s) with a missing endpoint`);
  return out;
}
