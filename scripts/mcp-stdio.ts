// Ripple MCP over stdio: `pnpm mcp`. Stdout is the protocol; every log goes to stderr.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { graphFor } from "../lib/graph/client";
import { createRippleServer } from "../lib/mcp/server";

const g = await graphFor(process.env.RIPPLE_GRAPH || "demo");
const now = Math.floor((process.env.RIPPLE_NOW ? Date.parse(process.env.RIPPLE_NOW) : Date.now()) / 1000);
await createRippleServer({ g, now, demo: true }).connect(new StdioServerTransport());
console.error("ripple MCP server ready on stdio");
