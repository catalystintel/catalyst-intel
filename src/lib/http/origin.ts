/**
 * Resolve the public origin of the current request. Important for OAuth
 * redirectTo on localhost (must be http, not https).
 */
export function getRequestOrigin(headerList: Headers): string {
  const origin = headerList.get("origin");
  if (origin) return origin;

  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) {
    throw new Error("Could not determine request host for OAuth redirect.");
  }

  const forwardedProto = headerList.get("x-forwarded-proto");
  const isLocal =
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("0.0.0.0");
  const proto = forwardedProto ?? (isLocal ? "http" : "https");

  return `${proto}://${host}`;
}

/** Only allow same-app relative paths for post-login redirects. */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }
  return next;
}
