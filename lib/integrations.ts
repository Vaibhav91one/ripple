// Copy-paste setup for every client that can reach Ripple's MCP server (#238). Pure: the page passes the public origin.
// Never put a real key in a snippet or link: org snippets use a placeholder or the RIPPLE_API_KEY env var.

export const KEY_PLACEHOLDER = "rpl_<prefix>_<secret>";

export const mcpUrl = (origin: string) => `${origin.replace(/\/+$/, "")}/api/mcp`;

/** Cursor one-click install. The config carries only the URL; a key is added by hand in mcp.json. */
export function cursorDeeplink(origin: string): string {
  const config = Buffer.from(JSON.stringify({ url: mcpUrl(origin) })).toString("base64");
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=ripple&config=${encodeURIComponent(config)}`;
}

const json = (v: unknown) => JSON.stringify(v, null, 2);

export type Snippet = { label: string; lang: string; code: string };

export function snippets(origin: string) {
  const url = mcpUrl(origin);
  const bearer = { Authorization: "Bearer ${RIPPLE_API_KEY}" };
  return {
    claudeCode: [
      { label: "Demo (no key)", lang: "shell", code: `claude mcp add --transport http ripple ${url}` },
      { label: "Your org", lang: "shell", code: `claude mcp add --transport http ripple ${url} --header "Authorization: Bearer ${KEY_PLACEHOLDER}"` },
      { label: "Project .mcp.json", lang: "json", code: json({ mcpServers: { ripple: { type: "http", url, headers: bearer } } }) },
    ],
    plugin: [{ label: "Plugin", lang: "Claude Code", code: "/plugin marketplace add Vaibhav91one/ripple\n/plugin install ripple@ripple" }],
    desktop: [
      { label: "Connector URL", lang: "url", code: url },
      { label: "Request header (your org)", lang: "header", code: `Authorization: Bearer ${KEY_PLACEHOLDER}` },
    ],
    codex: [
      { label: "~/.codex/config.toml", lang: "toml", code: `[mcp_servers.ripple]\nurl = "${url}"\nbearer_token_env_var = "RIPPLE_API_KEY"` },
      { label: "Skill (Codex reads .agents/skills in a repo)", lang: "shell", code: "cp -r ripple/.agents/skills/ripple-impact <your-repo>/.agents/skills/" },
    ],
    cursor: [
      { label: "Demo ~/.cursor/mcp.json", lang: "json", code: json({ mcpServers: { ripple: { url } } }) },
      { label: "Your org", lang: "json", code: json({ mcpServers: { ripple: { url, headers: { Authorization: `Bearer ${KEY_PLACEHOLDER}` } } } }) },
    ],
    chatgpt: [{ label: "Connector URL (no auth)", lang: "url", code: url }],
    endpoint: [{ label: "Streamable HTTP", lang: "url", code: url }],
  } satisfies Record<string, Snippet[]>;
}
