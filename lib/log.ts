// Secret masking for error messages that get logged or audited.
const TOKENS = [
  /xox[a-z]-[A-Za-z0-9-]+/g, // Slack
  /gh[sp]_[A-Za-z0-9]+/g, // GitHub app / personal tokens
  /sk-[A-Za-z0-9_-]+/g, // API keys
  /rpl_[A-Za-z0-9_-]+/g, // Ripple API keys
];
const TOKEN_ENC = /(["']?token_enc["']?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;})]+)/gi; // any token_enc value

export function redactSecrets(str: string): string {
  const s = TOKENS.reduce((acc, re) => acc.replace(re, "[redacted]"), str);
  return s.replace(TOKEN_ENC, "$1[redacted]");
}

/** Message of an unknown thrown value, redacted. pg-boss emits plain objects ({ ...err, message, stack, queue, worker }), which String() turns into "[object Object]": read their message, and say which queue. */
export function safeMessage(e: unknown): string {
  if (e instanceof Error) return redactSecrets(e.message);
  if (e && typeof e === "object") {
    const { message, queue, code } = e as { message?: unknown; queue?: unknown; code?: unknown };
    if (typeof message === "string") return redactSecrets(`${message}${typeof queue === "string" ? ` (queue ${queue})` : ""}${typeof code === "string" ? ` [${code}]` : ""}`);
    try { return redactSecrets(JSON.stringify(e)); } catch { /* circular: fall through */ }
  }
  return redactSecrets(String(e));
}
