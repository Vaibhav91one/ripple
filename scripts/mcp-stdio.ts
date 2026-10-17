// Ripple MCP over stdio: `pnpm mcp`. Stdout is the protocol; every log goes to stderr.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRippleServer } from "../lib/mcp/server";
import { getContext } from "../lib/server/context";

const ctx = await getContext();
await createRippleServer({ g: ctx.writer(), now: ctx.now, demo: ctx.org.isDemo }).connect(new StdioServerTransport());
console.error("ripple MCP server ready on stdio");
