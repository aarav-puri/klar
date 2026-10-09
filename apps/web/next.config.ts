import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Strict, nonce-free CSP. Next's runtime needs inline scripts for hydration
// data; everything else is same-origin.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  // "Sign in with Schoology" submits to Klar, which redirects to the school's own
  // Schoology host. form-action also governs that redirect, and school hosts
  // can be any domain, so allow https targets (never plain http).
  "form-action 'self' https:",
  "object-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  // Every app route is per-student and session-dependent, so we use classic
  // dynamic rendering rather than Cache Components.
  cacheComponents: false,
  poweredByHeader: false,
  devIndicators: { position: "bottom-right" },
  transpilePackages: ["@klar/core"],
  // PGlite ships its own WASM and data files; load it from node_modules at runtime.
  serverExternalPackages: ["@electric-sql/pglite"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
          ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
        ],
      },
      { source: "/app/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
