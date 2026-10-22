import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  // The embedded database is a local development fallback only; keep it out of deployed functions.
  outputFileTracingExcludes: { "*": ["node_modules/@electric-sql/pglite/**"] },
};

export default nextConfig;
