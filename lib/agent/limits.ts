import { env } from "../env";
// In-memory per-IP rate limit and daily token budget.
// ponytail: per-process state; move to Redis/KV if the app runs on more than one instance.
export const RATE_LIMIT = 20;
const HOUR = 3_600_000;
const hits = new Map<string, number[]>();

/** True when `ip` is under RATE_LIMIT requests in the last hour (and records this one). */
export function allow(ip: string, now = Date.now()): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < HOUR);
  const ok = recent.length < RATE_LIMIT;
  hits.set(ip, ok ? [...recent, now] : recent);
  return ok;
}

let day = "";
let used = 0;
function roll(now: number) {
  const d = new Date(now).toISOString().slice(0, 10);
  if (d !== day) [day, used] = [d, 0];
}

export function budgetLeft(now = Date.now()): boolean {
  roll(now);
  return used < env().DAILY_TOKEN_BUDGET;
}
export function spend(tokens: number, now = Date.now()): void {
  roll(now);
  used += tokens;
  void bump("global", { tokens }, now); // shared across instances when Postgres is configured
}

// ---- Demo budget (#231): counters in Postgres (usage_counter) so they hold across instances; in memory without a DB. ----
const dayOf = (now: number) => new Date(now).toISOString().slice(0, 10);
const mem = new Map<string, { prompts: number; tokens: number }>();
type Count = { prompts: number; tokens: number };

async function pgDb() {
  if (!env().DATABASE_URL) return null;
  try {
    const [{ db }, { usageCounters }, orm] = await Promise.all([import("../db"), import("../db/schema"), import("drizzle-orm")]);
    return { d: db(), usageCounters, ...orm };
  } catch {
    return null; // Postgres unreachable: fall back to this process's memory rather than failing the question
  }
}

export async function usageOf(key: string, now = Date.now()): Promise<Count> {
  const day = dayOf(now);
  const pg = await pgDb();
  if (pg) {
    try {
      const [r] = await pg.d.select().from(pg.usageCounters).where(pg.and(pg.eq(pg.usageCounters.key, key), pg.eq(pg.usageCounters.day, day)));
      return { prompts: r?.prompts ?? 0, tokens: r?.tokens ?? 0 };
    } catch {}
  }
  return mem.get(`${key}|${day}`) ?? { prompts: 0, tokens: 0 };
}

async function bump(key: string, by: Partial<Count>, now = Date.now()): Promise<void> {
  const day = dayOf(now);
  const pg = await pgDb();
  if (pg) {
    try {
      const { usageCounters: u, sql } = pg;
      await pg.d.insert(u).values({ key, day, prompts: by.prompts ?? 0, tokens: by.tokens ?? 0 })
        .onConflictDoUpdate({ target: [u.key, u.day], set: { prompts: sql`${u.prompts} + ${by.prompts ?? 0}`, tokens: sql`${u.tokens} + ${by.tokens ?? 0}` } });
      return;
    } catch {}
  }
  const k = `${key}|${day}`;
  const c = mem.get(k) ?? { prompts: 0, tokens: 0 };
  mem.set(k, { prompts: c.prompts + (by.prompts ?? 0), tokens: c.tokens + (by.tokens ?? 0) });
}

export type Quota = { ok: boolean; remaining: number | null; limit: number | null };

/** Per-visitor daily live-prompt quota, counted against the cookie and the IP (whichever has used more). Unlimited when DEMO_PROMPTS_PER_DAY is 0. `take` spends one prompt. */
export async function visitorQuota(visitor: { cookie: string; ip: string }, take: boolean, now = Date.now()): Promise<Quota> {
  const limit = env().DEMO_PROMPTS_PER_DAY;
  if (!limit) return { ok: true, remaining: null, limit: null };
  const keys = [`v:${visitor.cookie}`, `ip:${visitor.ip}`];
  const used = Math.max(...(await Promise.all(keys.map((k) => usageOf(k, now)))).map((c) => c.prompts));
  if (used >= limit) return { ok: false, remaining: 0, limit };
  if (take) await Promise.all(keys.map((k) => bump(k, { prompts: 1 }, now)));
  return { ok: true, remaining: limit - used - (take ? 1 : 0), limit };
}

/** The global daily token cap (DAILY_TOKEN_BUDGET), read from the shared counter. */
export async function tokensLeft(now = Date.now()): Promise<boolean> {
  return (await usageOf("global", now)).tokens < env().DAILY_TOKEN_BUDGET;
}
