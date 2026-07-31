import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Constant-time comparison so a caller can't learn the secret byte-by-byte
 * via response timing. Both sides are SHA-256 hashed first so length differs
 * cannot short-circuit before the equal check (fixed 32-byte digests).
 *
 * `expected` is typically `process.env.CRON_SECRET`; `provided` is the
 * `x-cron-secret` request header (or another shared secret header).
 */
export function isValidCronSecret(
  expected: string | undefined,
  provided: string | null,
): boolean {
  if (!expected || !provided) return false;

  const expectedDigest = createHash("sha256").update(expected).digest();
  const providedDigest = createHash("sha256").update(provided).digest();
  return timingSafeEqual(expectedDigest, providedDigest);
}
