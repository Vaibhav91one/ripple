// FalkorDB client. No `server-only` import so vitest and tsx (seed CLI) can load it.
import { FalkorDB } from "falkordb";
import { env } from "../env";
import type Graph from "falkordb/dist/src/graph";

export type { Graph };
export type Params = Record<string, unknown>;

let db: Promise<FalkorDB> | undefined;

export function client(): Promise<FalkorDB> {
  const e = env();
  db ??= FalkorDB.connect({
    password: e.FALKORDB_PASSWORD,
    socket: { host: e.FALKORDB_HOST, port: e.FALKORDB_PORT, ...(e.FALKORDB_TLS ? { tls: true as const } : {}) },
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
  const res = await graph.query<T>(cypher, { params: params as never });
  return res.data ?? [];
}

/** Read-only variant (GRAPH.RO_QUERY): FalkorDB rejects any write clause, so reads can never mutate. */
export async function roQuery<T = Record<string, unknown>>(
  graph: Graph,
  cypher: string,
  params: Params = {},
): Promise<T[]> {
  try {
    const res = await graph.roQuery<T>(cypher, { params: params as never });
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
