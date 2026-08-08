/**
 * Resolve the public origin of the current request. Important for OAuth
 * redirectTo on localhost (must be http, not https). Prefer the
 * load-balancer host on Vercel so mobile Safari / in-app browsers that omit
 * `Origin` on server actions still get a correct callback URL.
 */
export function getRequestOrigin(headerList: Headers): string {
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (host) {
    const forwardedProto = headerList.get("x-forwarded-proto");
    const isLocal =
      host.startsWith("localhost") ||
      host.startsWith("127.0.0.1") ||
      host.startsWith("0.0.0.0");
    const proto = forwardedProto ?? (isLocal ? "http" : "https");
    return `${proto}://${host}`;
  }

  const origin = headerList.get("origin");
  if (origin) return origin;

  throw new Error("Could not determine request host for OAuth redirect.");
}

/**
 * Origin Telegram should POST updates to. Must be the deployment that is
 * actually serving this request — not `NEXT_PUBLIC_APP_URL`, which may point
 * at a custom domain or disabled production host while staging is live.
 */
export function getTelegramWebhookOrigin(request: Request): string {
  try {
    return getRequestOrigin(request.headers);
  } catch {
    try {
      return new URL(request.url).origin;
    } catch {
      return getTrustedAppOrigin(request);
    }
  }
}

/**
 * Allowlisted public app origin for OAuth redirects. Prefer configured
 * `NEXT_PUBLIC_APP_URL`, then Vercel production/URL env — never trust a
 * bare client-controlled `X-Forwarded-Host` alone when these are set.
 */
export function getTrustedAppOrigin(
  request: Request,
  env: Record<string, string | undefined> = process.env,
): string {
  const configured = env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // fall through
    }
  }

  const productionHost = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (env.VERCEL_ENV === "production" && productionHost) {
    return `https://${productionHost.replace(/^https?:\/\//, "")}`;
  }

  const vercelUrl = env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/^https?:\/\//, "")}`;
  }

  return new URL(request.url).origin;
}

/**
 * Host used after OAuth exchange. If forwarded host is present, it must
 * match the trusted app origin (or be local dev); otherwise use trusted.
 */
export function resolveOAuthRedirectOrigin(request: Request): string {
  const trusted = getTrustedAppOrigin(request);
  const isLocal = process.env.NODE_ENV === "development";
  if (isLocal) {
    return new URL(request.url).origin;
  }

  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  if (!forwardedHost) {
    return trusted;
  }

  const forwardedOrigin = `https://${forwardedHost}`;
  try {
    if (new URL(forwardedOrigin).host === new URL(trusted).host) {
      return forwardedOrigin;
    }
  } catch {
    // fall through to trusted
  }

  // Preview deployments: allow the deployment's own VERCEL_URL host.
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl && forwardedHost === vercelUrl.replace(/^https?:\/\//, "")) {
    return forwardedOrigin;
  }

  return trusted;
}

/** Only allow same-app relative paths for post-login redirects. */
export function safeNextPath(
  next: string | null | undefined,
  fallback = "/catalyst-feed",
): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }
  // `/dashboard` was renamed; keep stale login `?next=` bookmarks working.
  if (next === "/dashboard" || next.startsWith("/dashboard/")) {
    return `/catalyst-feed${next.slice("/dashboard".length)}`;
  }
  return next;
}
