// One schema for all server env. env() re-reads process.env on every call (cheap; tests mutate it).
// Mode: warn (default) logs one line per bad var and falls back to the default; ENV_STRICT=1 throws.
// SKIP_ENV_VALIDATION=1 skips validation (builds) and uses plain defaults.
import { z } from "zod";

export const PROVIDERS = ["anthropic", "openai", "google", "openrouter", "openai-compatible", "ollama"] as const;

const str = z.string().optional();
const shape = {
  FALKORDB_HOST: z.string().default("localhost"),
  FALKORDB_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
  FALKORDB_PASSWORD: str,
  FALKORDB_QUERY_TIMEOUT_MS: z.coerce.number().int().min(100).default(10_000), // a query with no reply by then fails and resets the client
  FALKORDB_TLS: z.stringbool().default(false), // 1/true = TLS socket (FalkorDB Cloud)
  LLM_PROVIDER: z.string().refine((p) => (PROVIDERS as readonly string[]).includes(p), `must be one of ${PROVIDERS.join(", ")}`).optional(),
  LLM_API_KEY: str,
  LLM_BASE_URL: str,
  MODEL_AGENT: str,
  MODEL_EXTRACT: str,
  DAILY_TOKEN_BUDGET: z.coerce.number().int().min(0).default(2_000_000),
  ACK_TOKEN_SECRET: str,
  RESET_TOKEN: str,
  RESEND_API_KEY: str,
  RESEND_FROM: str,
  GITHUB_APP_ID: str,
  GITHUB_APP_INSTALLATION_ID: str,
  GITHUB_APP_PRIVATE_KEY: str,
  GITHUB_REPO: str,
  APP_URL: str, // public base URL used in message links (https://ripple.example); worker + email
  RIPPLE_GRAPH: str, // test-only graph override
  RIPPLE_NOW: str, // test-only clock override (ISO date)
  // future (Phase 0): optional until the features land
  DATABASE_URL: str,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: str,
  CLERK_SECRET_KEY: str,
  RIPPLE_AUTH: str, // "off" forces the public demo even when Clerk keys are set
  CLERK_WEBHOOK_SIGNING_SECRET: str,
  RIPPLE_SECRET_KEY: str, // 32-byte base64, encrypts connector tokens (lib/crypto.ts)
  SLACK_CLIENT_ID: str,
  SLACK_CLIENT_SECRET: str,
  SLACK_SIGNING_SECRET: str, // verifies /api/slack/* requests
  RIPPLE_SECRET_KEY_OLD: str, // previous key, decrypt-only during rotation
};
export type Env = z.infer<z.ZodObject<typeof shape>>;

const REQUIRED_IN_PROD = ["ACK_TOKEN_SECRET", "RESET_TOKEN"] as const;
const warned = new Set<string>();

export function env(src: Record<string, string | undefined> = process.env): Env {
  const strict = src.ENV_STRICT === "1";
  const skip = src.SKIP_ENV_VALIDATION === "1";
  const out: Record<string, unknown> = {};
  const problems: string[] = [];
  for (const [k, schema] of Object.entries(shape) as [string, z.ZodType][]) {
    const raw = src[k] === "" ? undefined : src[k]; // `FOO=` in .env means unset
    const r = schema.safeParse(raw);
    if (r.success) out[k] = r.data;
    else {
      if (!skip) problems.push(`${k}: ${r.error.issues[0].message}`);
      out[k] = schema.safeParse(undefined).data; // fall back to the default
    }
  }
  if (!skip && src.NODE_ENV === "production")
    for (const k of REQUIRED_IN_PROD) if (!out[k]) problems.push(`${k}: required in production`);
  if (strict && problems.length) throw new Error(`Invalid environment: ${problems.join("; ")}`);
  for (const p of problems) if (!warned.has(p)) { warned.add(p); console.warn(`[env] ${p}`); }
  return out as Env;
}
