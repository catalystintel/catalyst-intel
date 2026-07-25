import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
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
        ],
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
