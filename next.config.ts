import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "subset-font"],
  // The embedded database is a local development fallback only; keep it out of deployed functions.
  outputFileTracingExcludes: { "*": ["node_modules/@electric-sql/pglite/**"] },
  // PDF export reads its fonts from disk at runtime.
  outputFileTracingIncludes: { "/api/documents/[id]/export": ["./assets/fonts/**"] },
};

export default nextConfig;
