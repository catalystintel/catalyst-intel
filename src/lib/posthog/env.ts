/**
 * Public PostHog project API key. Prefers NEXT_PUBLIC_POSTHOG_KEY; falls back
 * to NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN (older main / Vercel naming).
 */
export function getPostHogKey(): string {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  if (key) return key;
  return process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim() ?? "";
}

/**
 * Returns true when PostHog public env looks like a real project API key
 * (not empty / placeholder). When false, analytics must no-op.
 */
export function isPostHogConfigured(): boolean {
  const key = getPostHogKey();

  if (!key) return false;
  if (key.includes("placeholder")) return false;

  // Project API keys are typically `phc_…`; also accept a long opaque token.
  return key.startsWith("phc_") || key.length > 20;
}

/** PostHog ingestion host. Defaults to US Cloud. */
export function getPostHogHost(): string {
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();
  return host && host.length > 0 ? host : "https://us.i.posthog.com";
}
