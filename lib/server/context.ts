// The one place a request (or script) learns which graph it is on, who is asking and what "now" is.
// Demo org only for now; multi-tenancy swaps the body of getContext, not its callers.
import { audit, type AuditEvent } from "../audit";
import { env } from "../env";
import { sessionViewer } from "../auth";
import { ensureSchema } from "../graph/schema";
import { graphFor, readOnly, type Graph } from "../graph/client";

/** The demo tenant's graph; the only default name in the codebase. */
export const DEMO_GRAPH = "demo";

export type Org = { id: string; graphName: string; isDemo: boolean };
export type Viewer =
  | { kind: "anon"; orgId: string; teamIds: string[]; role: "member" }
  | { kind: "user"; userId: string; orgId: string; teamIds: string[]; role: "member" | "admin" };
export type Context = {
  viewer: Viewer;
  org: Org;
  /** Read-only: `query()` (and every write helper) throws. */
  graph: Graph;
  /** Epoch seconds. RIPPLE_NOW (ISO) pins the clock so the seeded wait times stay put. */
  now: number;
  /** Awaited for writes, fire-and-forget for reads (`read: true`); never throws. */
  audit: (ev: AuditEvent) => Promise<void>;
  /** The writable graph, for the few routes that change state. */
  writer: () => Graph;
};

/** Per-org graph name: `t_` + the Clerk org id lowercased, non-alphanumerics as `_`. */
export const graphNameFor = (orgId: string) => `t_${orgId.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;

const ready = new Set<string>(); // org graphs whose schema this process has already created
const knownOrgs = new Set<string>(); // orgs already upserted into Postgres by this process

/** Signed in with an active Clerk org -> that org's graph; anyone else -> the demo. RIPPLE_GRAPH is a test-only graph override. */
export async function getContext(req?: Request): Promise<Context> {
  void req;
  const e = env();
  const session = await sessionViewer();
  const viewer: Viewer = session ?? { kind: "anon", orgId: DEMO_GRAPH, teamIds: [], role: "member" };
  const graphName = e.RIPPLE_GRAPH || (session ? graphNameFor(session.orgId) : DEMO_GRAPH);
  const raw = await graphFor(graphName);
  if (session && !e.RIPPLE_GRAPH) {
    if (!ready.has(graphName)) {
      await ensureSchema(raw); // indexes only, never seed data
      ready.add(graphName);
    }
    if (e.DATABASE_URL && !knownOrgs.has(session.orgId)) {
      knownOrgs.add(session.orgId);
      try { // webhook lag must not lock anyone out
        const [{ db }, { orgs }] = await Promise.all([import("../db"), import("../db/schema")]);
        const slug = session.orgSlug ?? session.orgId;
        await db().insert(orgs).values({ id: session.orgId, slug, graphName, isDemo: false }).onConflictDoNothing();
      } catch (err) {
        knownOrgs.delete(session.orgId);
        console.error("org upsert failed:", err instanceof Error ? err.message : err);
      }
    }
  }
  const org: Org = { id: viewer.orgId, graphName, isDemo: !session };
  return {
    viewer,
    org,
    graph: readOnly(raw),
    now: Math.floor((e.RIPPLE_NOW ? Date.parse(e.RIPPLE_NOW) : Date.now()) / 1000),
    audit: (ev) => audit({ org, viewer: { kind: viewer.kind, id: viewer.kind === "user" ? viewer.userId : undefined } }, ev),
    writer: () => raw,
  };
}
