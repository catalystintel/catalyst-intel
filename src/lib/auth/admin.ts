/**
 * Admin panel access is gated by verified Supabase session email
 * (Google OAuth JWT), not by a client-side flag or a manually promoted DB role.
 *
 * Override via comma-separated `ADMIN_EMAILS` env var. In production
 * (`NODE_ENV=production`) an empty/unset list fails closed — no defaults.
 * Local/dev keeps hard-coded operator defaults for convenience.
 */
const DEFAULT_ADMIN_EMAILS = [
  "zhbar10@gmail.com",
  "omer.nachshon@gmail.com",
] as const;

function parseAdminEmails(raw: string): string[] {
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function getAdminEmails(): string[] {
  const fromEnv = process.env.ADMIN_EMAILS?.trim();
  if (fromEnv) {
    return parseAdminEmails(fromEnv);
  }
  // Fail closed in production / preview builds (NODE_ENV=production on Vercel).
  if (process.env.NODE_ENV === "production") {
    return [];
  }
  return DEFAULT_ADMIN_EMAILS.map((email) => email.toLowerCase());
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.trim().toLowerCase());
}

export function adminRoleForEmail(
  email: string | null | undefined,
): "admin" | "user" {
  return isAdminEmail(email) ? "admin" : "user";
}
