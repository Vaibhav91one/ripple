import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cursorDeeplink, mcpUrl, snippets } from "./integrations";

const ORIGIN = "https://ripple.example.com/";
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("integration snippets", () => {
  it("builds the MCP URL from the deployment origin", () => {
    expect(mcpUrl(ORIGIN)).toBe("https://ripple.example.com/api/mcp");
    const all = Object.values(snippets(ORIGIN)).flat();
    for (const s of all.filter((s) => s.lang !== "Claude Code" && !s.code.startsWith("cp ") && !s.label.startsWith("Request header")))
      expect(s.code, s.label).toContain("https://ripple.example.com/api/mcp");
    expect(snippets(ORIGIN).claudeCode[0].code).toBe("claude mcp add --transport http ripple https://ripple.example.com/api/mcp");
  });

  it("never embeds a real key: placeholders or the env var only", () => {
    for (const s of Object.values(snippets(ORIGIN)).flat()) expect(s.code).not.toMatch(/rpl_[a-z0-9]{6,}_/i);
    expect(JSON.parse(snippets(ORIGIN).claudeCode[2].code)).toEqual({
      mcpServers: { ripple: { type: "http", url: "https://ripple.example.com/api/mcp", headers: { Authorization: "Bearer ${RIPPLE_API_KEY:-}" } } },
    });
  });

  it("Codex: demo snippet has only the url, the org snippet reads RIPPLE_API_KEY", () => {
    const [demo, org] = snippets(ORIGIN).codex;
    expect(demo.code).toBe('[mcp_servers.ripple]\nurl = "https://ripple.example.com/api/mcp"');
    expect(org.label).toMatch(/org keys/);
    expect(org.code).toContain('bearer_token_env_var = "RIPPLE_API_KEY"');
  });

  it("Cursor deeplink decodes to a URL-only config", () => {
    const link = new URL(cursorDeeplink(ORIGIN));
    expect(link.protocol).toBe("cursor:");
    expect(link.searchParams.get("name")).toBe("ripple");
    const config = JSON.parse(Buffer.from(link.searchParams.get("config")!, "base64").toString("utf8"));
    expect(config).toEqual({ url: "https://ripple.example.com/api/mcp" });
  });
});

describe("Claude Code plugin files", () => {
  it("marketplace lists the ripple plugin at ./plugin", () => {
    const m = JSON.parse(read(".claude-plugin/marketplace.json"));
    expect(m).toMatchObject({ name: "ripple", owner: { name: expect.any(String) } });
    expect(m.plugins).toEqual([expect.objectContaining({ name: "ripple", source: "./plugin" })]);
  });

  it("plugin.json has name, description, version, author", () => {
    const p = JSON.parse(read("plugin/.claude-plugin/plugin.json"));
    expect(p).toMatchObject({ name: "ripple", description: expect.any(String), author: { name: expect.any(String) } });
    expect(p.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("plugin .mcp.json uses the hosted URL with the env-var bearer", () => {
    const { mcpServers } = JSON.parse(read("plugin/.mcp.json"));
    expect(mcpServers.ripple).toMatchObject({ type: "http", url: expect.stringMatching(/^https:\/\/.+\/api\/mcp$/), headers: { Authorization: "Bearer ${RIPPLE_API_KEY:-}" } });
  });

  it("skill copies match skills/ripple-impact", () => {
    const src = read("skills/ripple-impact/SKILL.md");
    expect(read("plugin/skills/ripple-impact/SKILL.md")).toBe(src);
    expect(read(".agents/skills/ripple-impact/SKILL.md")).toBe(src);
  });
});
