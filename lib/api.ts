// Client-side data layer: fetches the /api route handlers and parses with the shared Zod schemas.
// NEXT_PUBLIC_RIPPLE_OFFLINE=1 serves lib/mock instead (demo without FalkorDB); it is never the default.
import { z } from "zod";
import {
  Artifact, BottleneckRow, Change, Decision, InboxItem, Person, RippleResult, WhoKnowsRow,
} from "@/lib/schemas";
import * as mock from "@/lib/mock/api";

export const OFFLINE = process.env.NEXT_PUBLIC_RIPPLE_OFFLINE === "1";

/** 503 from a route: FalkorDB is unreachable. Screens show GraphDownBanner. */
export class GraphDownError extends Error {
  readonly down = true; // keeps it distinct from Error so `isGraphDown` narrows
  constructor() {
    super("graph_down");
  }
}
export const isGraphDown = (e: unknown): e is GraphDownError => e instanceof GraphDownError;

async function call<S extends z.ZodType>(schema: S, url: string, init?: RequestInit): Promise<z.infer<S>> {
  const res = await fetch(url, init);
  if (res.status === 503) throw new GraphDownError();
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(body.message ?? body.error ?? `${url}: ${res.status}`);
  }
  return schema.parse(await res.json());
}
const qs = (o: Record<string, string | number>) => new URLSearchParams(Object.entries(o).map(([k, v]) => [k, String(v)])).toString();

export const getDecisions = (): Promise<Decision[]> =>
  OFFLINE ? mock.getDecisions() : call(z.array(Decision), "/api/decisions");

export const getRipple = (decisionId: string): Promise<RippleResult> =>
  OFFLINE ? mock.getRipple(decisionId) : call(RippleResult, `/api/ripple?${qs({ d: decisionId })}`);

/** `since` is epoch seconds. */
export const getChanges = (since: number): Promise<Change[]> =>
  OFFLINE ? mock.getChanges(since) : call(z.array(Change), `/api/changes?${qs({ since })}`);

export const getBottleneck = (): Promise<BottleneckRow[]> =>
  OFFLINE ? mock.getBottleneck() : call(z.array(BottleneckRow), "/api/bottleneck");

export const getWhoKnows = (systemId: string): Promise<WhoKnowsRow[]> =>
  OFFLINE ? mock.getWhoKnows(systemId) : call(z.array(WhoKnowsRow), `/api/who-knows?${qs({ system: systemId })}`);

export const getInbox = (personId: string): Promise<InboxItem[]> =>
  OFFLINE ? mock.getInbox(personId) : call(z.array(InboxItem), `/api/inbox?${qs({ p: personId })}`);

export const getSource = (artifactId: string): Promise<Artifact> =>
  OFFLINE ? mock.getSource(artifactId) : call(Artifact, `/api/source/${encodeURIComponent(artifactId)}`);

export const getPeople = (): Promise<Person[]> =>
  OFFLINE ? mock.getPeople() : call(z.array(Person), "/api/people");

/** id -> display name for teams, people, systems, customers, decisions, deals and contracts. */
export const getNames = (): Promise<Record<string, string>> =>
  OFFLINE ? mock.getNames() : call(z.record(z.string(), z.string()), "/api/names");

/** Move the decision's sunset to `newOn` (epoch seconds) on the graph and get the re-run ripple. */
export const postChange = (decisionId: string, newOn: number): Promise<RippleResult> =>
  OFFLINE
    ? mock.postChange(decisionId, newOn)
    : call(RippleResult, "/api/change", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decisionId, newOn }),
      });

/** Streams `/api/ask` (server-sent events); the route falls back to the cached mock answer without a model. */
export async function* askStream(question: string): AsyncGenerator<unknown> {
  const res = await fetch("/api/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!res.ok || !res.body) {
    const msg = await res.json().then((j: { error?: string }) => j.error, () => undefined);
    throw new Error(msg ?? `Ask failed (${res.status})`);
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += value;
    const frames = buf.split("\n\n");
    buf = frames.pop()!;
    for (const f of frames) {
      const data = f.split("\n").filter((l) => l.startsWith("data: ")).map((l) => l.slice(6)).join("\n");
      if (data) yield JSON.parse(data);
    }
  }
}
