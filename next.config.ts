import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // query wrappers read these files from process.cwd() at runtime; the tracer cannot see that
  outputFileTracingIncludes: {
    "/*": ["./lib/graph/queries/**/*.cypher", "./lib/db/migrations/**/*", "./scripts/migrate.mjs", "./node_modules/drizzle-orm/**/*", "./node_modules/postgres/**/*", "./lib/ingest/cache/**/*", "./node_modules/onnxruntime-node/**/*", "./node_modules/.pnpm/onnxruntime-common@1.30.0/**/*"],
  },
  cacheComponents: true,
  // bundling the redis client breaks the build ("a.BigInt is not a function")
  // transformers.js loads onnxruntime-node (native .so) by dynamic import, which the tracer misses: keep both external
  serverExternalPackages: ["falkordb", "@redis/client", "@huggingface/transformers", "onnxruntime-node", "unpdf", "mammoth"],
  partialPrefetching: true,
  // v1 -> v2 IA (#227): every old tab lands on its v2 home. /connectors/* setup flows stay until they move under /connections.
  async redirects() {
    return [
      { source: "/home", destination: "/", permanent: true },
      { source: "/inbox", destination: "/", permanent: true },
      { source: "/approvals", destination: "/", permanent: true }, // Needs you lives on the Assistant
      { source: "/changes", destination: "/reports", permanent: true },
      { source: "/changes/:id", destination: "/reports/:id", permanent: true },
      { source: "/decisions", destination: "/reports", permanent: true },
      { source: "/decisions/:id", destination: "/reports/:id", permanent: true },
      { source: "/overview", destination: "/analytics", permanent: true },
      { source: "/graph", destination: "/analytics#graph", permanent: true },
      { source: "/it", destination: "/reports?kind=access", permanent: true },
      { source: "/teams/:team", destination: "/agents?team=:team", permanent: true },
      { source: "/connectors", destination: "/connections", permanent: true },
      // v1 share links: /ripple?d=X opens that case, bare /ripple opens analytics
      { source: "/ripple", has: [{ type: "query", key: "d", value: "(?<d>.+)" }], destination: "/reports/:d", permanent: false },
      { source: "/ripple", destination: "/analytics", permanent: false },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
