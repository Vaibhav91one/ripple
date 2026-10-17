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

/** Message of an unknown thrown value, redacted. */
export const safeMessage = (e: unknown) => redactSecrets(e instanceof Error ? e.message : String(e));
