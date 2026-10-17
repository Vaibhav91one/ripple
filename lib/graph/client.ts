// FalkorDB client. No `server-only` import so vitest and tsx (seed CLI) can load it.
import { FalkorDB } from "falkordb";
import { env } from "../env";
import type Graph from "falkordb/dist/src/graph";

export type { Graph };
export type Params = Record<string, unknown>;

let db: Promise<FalkorDB> | undefined;

/** A query that gets no reply in this long means a dead connection: fail it and rebuild the client. */
export const QUERY_TIMEOUT_MS = Number(process.env.FALKORDB_QUERY_TIMEOUT_MS) || 30_000;

/** Drop the cached client (best effort close) so the next call reconnects from scratch. */
function resetClient(p: Promise<FalkorDB>): void {
  if (db === p) db = undefined;
  void p.then((c) => c.close()).catch(() => {});
}

/** Fail fast instead of hanging forever when the connection died without a clean close (FalkorDB restart). */
async function guard<T>(run: () => Promise<T>): Promise<T> {
  const p = client();
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      run(),
      new Promise<never>((_, rej) => {
        timer = setTimeout(() => {
          resetClient(p);
          rej(new Error(`FalkorDB query timed out after ${QUERY_TIMEOUT_MS}ms`));
        }, QUERY_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function client(): Promise<FalkorDB> {
  const e = env();
  const socket = {
    host: e.FALKORDB_HOST,
    port: e.FALKORDB_PORT,
    reconnectStrategy: (n: number) => Math.min(100 * 2 ** n, 2000), // keep retrying forever, at most 2s apart
    socketTimeout: 15_000, // half-open socket (server gone without FIN): destroy it so reconnect kicks in
  };
  db ??= FalkorDB.connect({
    password: e.FALKORDB_PASSWORD,
    socket: e.FALKORDB_TLS ? { ...socket, tls: true as const } : socket,
    pingInterval: 5_000, // keeps the socket warm so socketTimeout only fires on a dead connection
    ...{ disableOfflineQueue: true }, // not in FalkorDBOptions' types but passed through to node-redis: fail commands at once while reconnecting
  }).then((c) => {
    c.on("error", () => {}); // reconnectStrategy handles recovery; an unhandled "error" event would throw
    return c;
  }).catch((e) => {
    db = undefined; // don't cache a failed connect: the next request retries
    throw e;
  });
  return db;
}

export async function closeClient(): Promise<void> {
  const p = db;
  db = undefined;
  if (p) await (await p).close();
}

/** One graph per tenant; the demo tenant is `demo`. */
export async function graphFor(tenant: string): Promise<Graph> {
  return (await client()).selectGraph(tenant);
}

/** Parameterised query; never interpolate values into `cypher`. */
export async function query<T = Record<string, unknown>>(
  graph: Graph,
  cypher: string,
  params: Params = {},
): Promise<T[]> {
  const res = await guard(() => graph.query<T>(cypher, { params: params as never }));
  return res.data ?? [];
}

/** Read-only variant (GRAPH.RO_QUERY): FalkorDB rejects any write clause, so reads can never mutate. */
export async function roQuery<T = Record<string, unknown>>(
  graph: Graph,
  cypher: string,
  params: Params = {},
): Promise<T[]> {
  try {
    const res = await guard(() => graph.roQuery<T>(cypher, { params: params as never }));
    return res.data ?? [];
  } catch (e) {
    // A graph that was never written (new org, fresh volume) has no key; RO_QUERY then errors instead of
    // returning nothing. A missing graph is an empty graph.
    if (/empty key/i.test(String(e))) return [];
    throw e;
  }
}

export class ReadOnlyGraphError extends Error {
  constructor() {
    super("write attempted on a read-only graph");
  }
}

/** Wrap a graph so only `roQuery` works: `query()` (and so every write helper) throws ReadOnlyGraphError. */
export function readOnly(g: Graph): Graph {
  return new Proxy(g, {
    get(t, p) {
      if (p === "query") return () => { throw new ReadOnlyGraphError(); };
      const v = Reflect.get(t, p, t);
      return typeof v === "function" ? v.bind(t) : v;
    },
  });
}
