/**
 * Canonical hosts where Google OAuth is allowed to start and finish.
 *
 * Ephemeral Vercel preview URLs (e.g. catalyst-intel-rouge.vercel.app) are
 * NOT allowlisted in Supabase Redirect URLs and often have Deployment
 * Protection on — starting OAuth there drops the PKCE verifier on host A
 * while Supabase returns the code to host B, or Vercel SSO sends the user
 * to vercel.com. Bounce those hosts to production login first.
 */

/** Stable production + staging hosts we always treat as auth-safe. */
export const KNOWN_AUTH_HOSTS = [
  "www.marveel.com",
  "marveel.com",
  "catalyst-intel-catalyst-intel.vercel.app",
  "catalyst-intel-git-dev-zhbar10s-projects.vercel.app",
] as const;

/** Canonical production origin for OAuth bounce / “sign in here” links. */
export const DEFAULT_PRODUCTION_AUTH_ORIGIN = "https://www.marveel.com";

function hostFromUrlish(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const withProto = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(withProto).host.toLowerCase();
  } catch {
    return null;
  }
}

function originFromHost(host: string): string {
  if (
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("0.0.0.0")
  ) {
    return `http://${host}`;
  }
  return `https://${host}`;
}

/** Collect every host that may safely run the Google OAuth PKCE dance. */
export function getAllowedAuthHosts(
  env: Record<string, string | undefined> = process.env,
): Set<string> {
  const hosts = new Set<string>(KNOWN_AUTH_HOSTS);

  for (const key of [
    "NEXT_PUBLIC_AUTH_ORIGIN",
    "NEXT_PUBLIC_APP_URL",
    "VERCEL_PROJECT_PRODUCTION_URL",
  ] as const) {
    const host = hostFromUrlish(env[key]);
    if (host) hosts.add(host);
  }

  // Current deployment host is OK only for production / known staging — not
  // for random PR preview hashes (those lack Supabase redirect allowlist +
  // often hit Vercel Deployment Protection → vercel.com).
  const vercelEnv = env.VERCEL_ENV?.trim();
  const vercelHost = hostFromUrlish(env.VERCEL_URL);
  if (vercelHost && vercelEnv === "production") {
    hosts.add(vercelHost);
  }

  return hosts;
}

/**
 * Preferred public origin for “please sign in here” links when the user is
 * on an unsafe preview host.
 */
export function getPreferredAuthOrigin(
  env: Record<string, string | undefined> = process.env,
): string {
  const authOrigin = env.NEXT_PUBLIC_AUTH_ORIGIN?.trim();
  if (authOrigin) {
    try {
      const withProto = /^https?:\/\//i.test(authOrigin)
        ? authOrigin
        : `https://${authOrigin}`;
      return new URL(withProto).origin;
    } catch {
      // fall through
    }
  }

  const appUrl = env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    try {
      const withProto = /^https?:\/\//i.test(appUrl)
        ? appUrl
        : `https://${appUrl}`;
      const url = new URL(withProto);
      // APP_URL alone must be a known host — blocks typos like www.marvel.com.
      if (
        isLocalAuthHost(url.host) ||
        (KNOWN_AUTH_HOSTS as readonly string[]).includes(url.host.toLowerCase())
      ) {
        return url.origin;
      }
    } catch {
      // fall through
    }
  }

  const productionHost = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (productionHost) {
    try {
      const withProto = /^https?:\/\//i.test(productionHost)
        ? productionHost
        : `https://${productionHost}`;
      const url = new URL(withProto);
      if (
        (KNOWN_AUTH_HOSTS as readonly string[]).includes(url.host.toLowerCase())
      ) {
        return url.origin;
      }
    } catch {
      // fall through
    }
  }

  return DEFAULT_PRODUCTION_AUTH_ORIGIN;
}

export function isLocalAuthHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === "localhost" ||
    h.startsWith("localhost:") ||
    h === "127.0.0.1" ||
    h.startsWith("127.0.0.1:") ||
    h === "0.0.0.0" ||
    h.startsWith("0.0.0.0:")
  );
}

/** True when OAuth may start on this origin without bouncing. */
export function isAllowedAuthOrigin(
  originOrHost: string,
  env: Record<string, string | undefined> = process.env,
): boolean {
  let host: string;
  try {
    host = originOrHost.includes("://")
      ? new URL(originOrHost).host.toLowerCase()
      : originOrHost.toLowerCase();
  } catch {
    return false;
  }

  if (isLocalAuthHost(host)) return true;
  return getAllowedAuthHosts(env).has(host);
}

/**
 * If the request host is not auth-safe, return the preferred production
 * login URL (preserving `next`). Otherwise null (stay).
 */
export function authHostBounceUrl(
  requestUrl: string | URL,
  env: Record<string, string | undefined> = process.env,
): string | null {
  const url = typeof requestUrl === "string" ? new URL(requestUrl) : requestUrl;
  if (isAllowedAuthOrigin(url.origin, env)) return null;

  const preferred = getPreferredAuthOrigin(env);
  // Avoid a redirect loop if preferred somehow equals the bad host.
  if (url.origin === preferred) return null;

  const login = new URL("/login", preferred);
  const next = url.searchParams.get("next");
  if (next?.startsWith("/") && !next.startsWith("//")) {
    login.searchParams.set("next", next);
  } else if (url.pathname !== "/login" && url.pathname !== "/auth/login") {
    login.searchParams.set("next", `${url.pathname}${url.search}`);
  }
  login.searchParams.set("message", "use_production_login");
  return login.toString();
}

/** Build a same-host login URL helper for tests / docs. */
export function authOriginFromHost(host: string): string {
  return originFromHost(host);
}
