/**
 * Polished copy for trader-facing surfaces. Ops/setup detail belongs in
 * server logs, admin tools, and local-dev notices — never in desk toasts,
 * API `error` bodies for public routes, or marketing/auth UI.
 */

export const USER_FACING = {
  generic: "Something went wrong. Please try again.",
  unavailable:
    "This service is temporarily unavailable. Please try again shortly.",
  database:
    "The desk is temporarily unavailable. Please try again in a moment.",
  databaseQuota: "The desk is temporarily at capacity. Please try again later.",
  signInUnavailable:
    "Sign-in is temporarily unavailable. Please try again shortly.",
  previewAdminOnly:
    "This preview / staging link is restricted to admins. Use the production site to sign in.",
  aiUnavailable:
    "AI analysis is not available at the moment. You can try again shortly.",
  pushUnavailable: "Browser push is not available right now.",
  emailUnavailable: "Email delivery is not available right now.",
  telegramUnavailable: "Telegram delivery is not available right now.",
  chartUnavailable: "Chart data is unavailable right now.",
  loadFailed: "Could not load this data. Please try again.",
} as const;

const OPS_LEAK_PATTERN =
  /\b(LIBSQL_|DATABASE_URL|OPENROUTER_|RESEND_|TELEGRAM_BOT|WEB_PUSH_|NEXT_PUBLIC_|SUPABASE_|Vercel|Turso|DEPLOYMENT\.md|npm run |\.env\.local|BLOCKED|SQLITE_|local\.db|file:)/i;

/** Raw vendor/env credential names that must not appear in product UI. */
const SOURCE_KEY_ENV_PATTERN =
  /\b(?:[A-Z][A-Z0-9_]*(?:_API_KEY|_API_KEYS|_API_BASE)|SEC_EDGAR_USER_AGENT|PR_WIRE_API_\*)\b/i;

/**
 * True when a string looks like operator/setup detail that should not be
 * shown verbatim on trader surfaces.
 */
export function looksLikeOpsMessage(message: string): boolean {
  return OPS_LEAK_PATTERN.test(message) || SOURCE_KEY_ENV_PATTERN.test(message);
}

/**
 * Soften leftover env/credential token names in copy that still has a
 * useful product meaning (e.g. empty-state notes). Prefer fixing messages
 * at the source; this is a display-side belt-and-suspenders scrub.
 */
export function scrubEnvNamesFromMessage(message: string): string {
  return message
    .replace(new RegExp(SOURCE_KEY_ENV_PATTERN.source, "gi"), "credentials")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Maps unknown / API / thrown errors to safe desk copy. Known polished
 * product messages pass through; ops/setup leaks are replaced.
 */
export function toUserFacingMessage(
  err: unknown,
  fallback: string = USER_FACING.generic,
): string {
  const raw =
    typeof err === "string"
      ? err
      : err instanceof Error
        ? err.message
        : fallback;
  const message = raw.trim();
  if (!message) return fallback;

  if (
    /quota exceeded|reads are blocked|SQL read operations are forbidden/i.test(
      message,
    )
  ) {
    return USER_FACING.databaseQuota;
  }
  if (
    /Database is not configured|Local SQLite is missing|databaseSetup|not configured for this environment/i.test(
      message,
    )
  ) {
    return USER_FACING.database;
  }
  if (/Supabase is not configured/i.test(message)) {
    return USER_FACING.signInUnavailable;
  }
  if (/preview_admin_only|Preview deployments are admin-only/i.test(message)) {
    return USER_FACING.previewAdminOnly;
  }
  if (/AI analysis is not configured|OpenRouter/i.test(message)) {
    return USER_FACING.aiUnavailable;
  }
  if (/WEB_PUSH_VAPID|push.*(not configured|unavailable)/i.test(message)) {
    return USER_FACING.pushUnavailable;
  }
  if (
    /RESEND_API_KEY|email delivery skipped|Resend.*(not configured|unavailable)/i.test(
      message,
    )
  ) {
    return USER_FACING.emailUnavailable;
  }
  if (/TELEGRAM_BOT_TOKEN|Telegram delivery skipped/i.test(message)) {
    return USER_FACING.telegramUnavailable;
  }
  if (looksLikeOpsMessage(message)) {
    return fallback;
  }
  return message;
}
