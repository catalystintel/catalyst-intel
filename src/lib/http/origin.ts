import {
  DEFAULT_PRODUCTION_AUTH_ORIGIN,
  KNOWN_AUTH_HOSTS,
  isLocalAuthHost,
} from "@/lib/http/auth-origin";

function isStableAuthHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    isLocalAuthHost(h) || (KNOWN_AUTH_HOSTS as readonly string[]).includes(h)
  );
}

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
 * `NEXT_PUBLIC_AUTH_ORIGIN` / `NEXT_PUBLIC_AUTH_URL` (alias) /
 * `NEXT_PUBLIC_APP_URL` only when the host is a known auth host (blocks typos
 * like www.marvel.com), then Vercel envs.
 */
export function getTrustedAppOrigin(
  request: Request,
  env: Record<string, string | undefined> = process.env,
): string {
  for (const key of [
    "NEXT_PUBLIC_AUTH_ORIGIN",
    "NEXT_PUBLIC_AUTH_URL",
    "NEXT_PUBLIC_APP_URL",
  ] as const) {
    const configured = env[key]?.trim();
    if (!configured) continue;
    try {
      const withProto = /^https?:\/\//i.test(configured)
        ? configured
        : `https://${configured}`;
      const url = new URL(withProto);
      if (isStableAuthHost(url.host)) {
        return url.origin;
      }
    } catch {
      // fall through
    }
  }

  const productionHost = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (env.VERCEL_ENV === "production" && productionHost) {
    const host = productionHost.replace(/^https?:\/\//, "");
    if (isStableAuthHost(host)) {
      return `https://${host}`;
    }
  }

  try {
    const requestHost = new URL(request.url).host;
    if (isStableAuthHost(requestHost)) {
      return new URL(request.url).origin;
    }
  } catch {
    // fall through
  }

  const vercelUrl = env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/^https?:\/\//, "")}`;
  }

  return DEFAULT_PRODUCTION_AUTH_ORIGIN;
}

/**
 * Host used after OAuth exchange. Prefer the request's stable auth host
 * (e.g. www.marveel.com) so a mistyped NEXT_PUBLIC_APP_URL cannot bounce
 * mobile users to a different site after Google returns.
 */
export function resolveOAuthRedirectOrigin(
  request: Request,
  env: Record<string, string | undefined> = process.env,
): string {
  const isLocal = env.NODE_ENV === "development";
  if (isLocal) {
    return new URL(request.url).origin;
  }

  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  if (forwardedHost && isStableAuthHost(forwardedHost)) {
    return isLocalAuthHost(forwardedHost)
      ? `http://${forwardedHost}`
      : `https://${forwardedHost}`;
  }

  const trusted = getTrustedAppOrigin(request, env);
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
  const vercelUrl = env.VERCEL_URL?.trim();
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
