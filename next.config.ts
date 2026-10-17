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
  // v1 URLs: /ripple?d=X opens that decision, bare /ripple opens the overview
  async redirects() {
    return [
      { source: "/inbox", destination: "/home", permanent: true }, // Home shows everything the inbox did
      { source: "/ripple", has: [{ type: "query", key: "d", value: "(?<d>.+)" }], destination: "/decisions/:d", permanent: false },
      { source: "/ripple", destination: "/overview", permanent: false },
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
