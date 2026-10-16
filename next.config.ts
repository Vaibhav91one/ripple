import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // query wrappers read these files from process.cwd() at runtime; the tracer cannot see that
  outputFileTracingIncludes: {
    "/*": ["./lib/graph/queries/**/*.cypher", "./lib/ingest/cache/**/*"],
  },
  cacheComponents: true,
  // bundling the redis client breaks the build ("a.BigInt is not a function")
  serverExternalPackages: ["falkordb", "@redis/client"],
  partialPrefetching: true,
  // v1 URLs: /ripple?d=X opens that decision, bare /ripple opens the overview
  async redirects() {
    return [
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
