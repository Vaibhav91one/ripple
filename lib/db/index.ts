import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let cached: PostgresJsDatabase<typeof schema> | undefined;

/** Lazy: nothing connects at import time, and the demo runs fine without DATABASE_URL. */
export function db() {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set: Postgres is required for orgs, API keys and the audit log");
  return (cached = drizzle(postgres(url), { schema }));
}
