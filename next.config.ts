import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  {
    // Start permissive enough for Next/fonts, Supabase Auth, PostHog, and
    // TradingView embeds; tighten further once report-only telemetry exists.
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://us.i.posthog.com https://us-assets.i.posthog.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://us.i.posthog.com https://us-assets.i.posthog.com https://*.i.posthog.com https://openrouter.ai https://api.telegram.org",
      "frame-src 'self' https://s.tradingview.com https://www.tradingview.com https://*.tradingview.com",
      "worker-src 'self' blob:",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  /* config options here */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      // `/dashboard` was renamed to `/catalyst-feed` to match the sidebar
      // label. Keep old bookmarks / external links working indefinitely.
      {
        source: "/dashboard",
        destination: "/catalyst-feed",
        permanent: true,
      },
      {
        source: "/dashboard/:path*",
        destination: "/catalyst-feed/:path*",
        permanent: true,
      },
      // News Feed unshipped; Reports / Analytics are Coming Soon in the sidebar.
      {
        source: "/news-feed",
        destination: "/catalyst-feed",
        permanent: false,
      },
      {
        source: "/analytics",
        destination: "/catalyst-feed",
        permanent: false,
      },
      {
        source: "/reports",
        destination: "/catalyst-feed",
        permanent: false,
      },
      {
        source: "/reports/s/:token",
        destination: "/catalyst-feed",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://us-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  skipTrailingSlashRedirect: true,
  // The admin "run migrations" route calls drizzle's migrator at runtime
  // (see src/app/api/admin/migrate/route.ts), which reads the *.sql files
  // under drizzle/ from disk. Vercel's file tracer only bundles files a
  // route imports via JS, so the SQL migration files must be listed
  // explicitly or the route 404s on missing files in production.
  outputFileTracingIncludes: {
    "/api/admin/migrate": ["./drizzle/**/*"],
  },
};

export default nextConfig;
