import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // bundling the redis client breaks page-data collection ("a.BigInt is not a function")
  serverExternalPackages: ["falkordb"],
  // query wrappers read these files from process.cwd() at runtime; the tracer cannot see that
  outputFileTracingIncludes: {
    "/*": ["./lib/graph/queries/**/*.cypher", "./lib/ingest/cache/**/*"],
  },
  cacheComponents: true,
  serverExternalPackages: ["falkordb", "@redis/client"],
  partialPrefetching: true,
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
