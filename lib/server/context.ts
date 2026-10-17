// The one place a request (or script) learns which graph it is on, who is asking and what "now" is.
// Demo org only for now; multi-tenancy swaps the body of getContext, not its callers.
import { audit, type AuditEvent } from "../audit";
import { env } from "../env";
import { graphFor, readOnly, type Graph } from "../graph/client";

/** The demo tenant's graph; the only default name in the codebase. */
export const DEMO_GRAPH = "demo";

export type Org = { id: string; graphName: string; isDemo: boolean };
export type Viewer = { kind: "anon"; orgId: string; teamIds: string[]; role: "member" };
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

/** `req` is unused until viewers are resolved from it; RIPPLE_GRAPH is a test-only graph override. */
export async function getContext(req?: Request): Promise<Context> {
  void req;
  const e = env();
  const graphName = e.RIPPLE_GRAPH || DEMO_GRAPH;
  const raw = await graphFor(graphName);
  const viewer: Viewer = { kind: "anon", orgId: DEMO_GRAPH, teamIds: [], role: "member" };
  const org: Org = { id: DEMO_GRAPH, graphName, isDemo: true };
  return {
    viewer,
    org,
    graph: readOnly(raw),
    now: Math.floor((e.RIPPLE_NOW ? Date.parse(e.RIPPLE_NOW) : Date.now()) / 1000),
    audit: (ev) => audit({ org, viewer }, ev),
    writer: () => raw,
  };
}
