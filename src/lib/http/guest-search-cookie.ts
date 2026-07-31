import { createHmac, timingSafeEqual } from "node:crypto";

export const GUEST_SEARCH_LIMIT = 3;
export const GUEST_SEARCH_COOKIE = "ci.guest-search";
export const GUEST_SEARCH_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 1 week

/**
 * Signing material for the guest search quota cookie. Prefer a dedicated
 * secret; fall back to CRON_SECRET / Supabase anon key so local/dev still
 * works without another env var.
 */
function guestCookieSecret(): string {
  return (
    process.env.GUEST_SEARCH_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    "local-dev-guest-search"
  );
}

function signCount(count: number): string {
  const payload = String(Math.max(0, Math.floor(count)));
  const mac = createHmac("sha256", guestCookieSecret())
    .update(`guest-search:${payload}`)
    .digest("base64url");
  return `${payload}.${mac}`;
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

/**
 * Reads the HMAC-signed guest search count. Tampered / unsigned cookies
 * reset to 0 (treated as unused quota).
 */
export function readGuestSearchCount(raw: string | undefined): number {
  if (!raw) return 0;
  const [payload, mac] = raw.split(".");
  if (!payload || !mac) return 0;
  const n = Number.parseInt(payload, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  const expected = signCount(n);
  const [, expectedMac] = expected.split(".");
  if (!expectedMac || !safeEqual(mac, expectedMac)) return 0;
  return n;
}

/** Builds the next signed cookie value after a successful guest search. */
export function writeGuestSearchCount(count: number): string {
  return signCount(count);
}
