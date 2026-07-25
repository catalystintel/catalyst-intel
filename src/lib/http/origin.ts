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

/** Only allow same-app relative paths for post-login redirects. */
export function safeNextPath(
  next: string | null | undefined,
  fallback = "/catalyst-feed",
): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }
  return next;
}
