// The one place a request (or script) learns which graph it is on, who is asking and what "now" is.
// Demo org only for now; multi-tenancy swaps the body of getContext, not its callers.
import { cookies } from "next/headers";
import { audit, type AuditEvent } from "../audit";
import { env } from "../env";
import { safeMessage } from "../log";
import { LENS_COOKIE, LENS_TEAM, parseLens } from "../lens";
import { sessionViewer } from "../auth";
import { ensureSchema } from "../graph/schema";
import { healDemo } from "../graph/bootstrap";
import { graphFor, readOnly, type Graph } from "../graph/client";

/** The demo tenant's graph; the only default name in the codebase. */
export const DEMO_GRAPH = "demo";

export type Org = { id: string; graphName: string; isDemo: boolean };
export type Viewer =
  | { kind: "anon"; orgId: string; teamIds: string[]; role: "member" | "change_owner" }
  | { kind: "user"; userId: string; orgId: string; teamIds: string[]; role: "member" | "lead" | "admin" | "change_owner"; personId?: string };
export type Context = {
  viewer: Viewer;
  org: Org;
  /** True for anonymous viewers of the shared demo: every write is refused (`denyIfReadonly`). Tests on a temp graph (RIPPLE_GRAPH) are not locked. */
  readonly: boolean;
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

/** The demo lens cookie -> one team id; no request scope (scripts, tests) -> the default lens. */
async function lensTeam(): Promise<string> {
  const seam = process.env.RIPPLE_GRAPH && process.env.RIPPLE_VIEW_AS; // test-only: act as these teams (comma list) on a temp graph
  if (seam) return seam;
  try {
    return LENS_TEAM[parseLens((await cookies()).get(LENS_COOKIE)?.value)];
  } catch {
    return LENS_TEAM[parseLens(undefined)];
  }
}

/** The demo's change-owner lens acts as the change_owner role (summary-level numbers); the test seam sets it via RIPPLE_VIEW_ROLE. */
async function lensRole(): Promise<"member" | "change_owner"> {
  if (process.env.RIPPLE_GRAPH && process.env.RIPPLE_VIEW_AS) return process.env.RIPPLE_VIEW_ROLE === "change_owner" ? "change_owner" : "member";
  try {
    return parseLens((await cookies()).get(LENS_COOKIE)?.value) === "change-owner" ? "change_owner" : "member";
  } catch {
    return parseLens(undefined) === "change-owner" ? "change_owner" : "member";
  }
}

const ready = new Set<string>(); // org graphs whose schema this process has already created
const knownOrgs = new Set<string>(); // orgs already upserted into Postgres by this process

/** Fill teams, role and person link from Postgres memberships; Clerk's org:admin always wins. No DB or a lookup failure keeps the session as is. */
async function withMembership<V extends Extract<Viewer, { kind: "user" }>>(v: V): Promise<V> {
  if (!env().DATABASE_URL) return v;
  try {
    const { getMember } = await import("../members");
    const m = await getMember(v.orgId, v.userId);
    return m ? { ...v, teamIds: m.teamIds, role: v.role === "admin" ? "admin" : m.role, personId: m.personId ?? undefined } : v;
  } catch (err) {
    console.error("membership lookup failed:", safeMessage(err));
    return v;
  }
}

/** Signed in with an active Clerk org -> that org's graph; anyone else -> the demo. RIPPLE_GRAPH is a test-only graph override. */
export async function getContext(req?: Request): Promise<Context> {
  void req;
  const e = env();
  const session = await sessionViewer();
  const viewer: Viewer = (session && (await withMembership(session))) ?? { kind: "anon", orgId: DEMO_GRAPH, teamIds: (await lensTeam()).split(","), role: await lensRole() };
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
        console.error("org upsert failed:", safeMessage(err));
      }
    }
  }
  const org: Org = { id: viewer.orgId, graphName, isDemo: !session };
  if (org.isDemo && !e.RIPPLE_GRAPH) healDemo(graphName); // throttled, never awaited
  return {
    viewer,
    org,
    readonly: !session && !e.RIPPLE_GRAPH,
    graph: readOnly(raw),
    now: Math.floor((e.RIPPLE_NOW ? Date.parse(e.RIPPLE_NOW) : Date.now()) / 1000),
    audit: (ev) => audit({ org, viewer: { kind: viewer.kind, id: viewer.kind === "user" ? viewer.userId : undefined } }, ev),
    writer: () => raw,
  };
}
