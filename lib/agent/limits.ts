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
  return used < Number(process.env.DAILY_TOKEN_BUDGET ?? 2_000_000);
}
export function spend(tokens: number, now = Date.now()): void {
  roll(now);
  used += tokens;
}
