import {
  getPostHogClient,
  isPostHogServerConfigured,
} from "@/lib/posthog-server";

export type ReportedErrorContext = Record<
  string,
  string | number | boolean | null | undefined
>;

/**
 * Logs an error and, when PostHog is configured, captures it as an exception
 * so production failures show up in product analytics / error tracking without
 * requiring a separate Sentry project for MVP.
 *
 * Never throws — observability must not break request handling.
 */
export async function reportServerError(
  error: unknown,
  context: ReportedErrorContext = {},
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[error]", message, context, error);

  if (!isPostHogServerConfigured()) return;

  try {
    const posthog = getPostHogClient();
    const distinctId =
      typeof context.distinctId === "string" && context.distinctId
        ? context.distinctId
        : "server";

    const properties: Record<string, string | number | boolean | null> = {};
    for (const [key, value] of Object.entries(context)) {
      if (key === "distinctId") continue;
      if (value === undefined) continue;
      properties[key] = value;
    }

    posthog.captureException(
      error instanceof Error ? error : new Error(message),
      distinctId,
      properties,
    );
    await posthog.flush();
  } catch (reportError) {
    console.error(
      "[error] failed to report to PostHog:",
      reportError instanceof Error ? reportError.message : reportError,
    );
  }
}
