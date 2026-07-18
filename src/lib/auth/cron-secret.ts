import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time comparison so a caller can't learn the secret byte-by-byte
 * via response timing. `expected` is `process.env.CRON_SECRET`, `provided`
 * is the `x-cron-secret` request header.
 */
export function isValidCronSecret(
  expected: string | undefined,
  provided: string | null,
): boolean {
  if (!expected || !provided) return false;

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;

  return timingSafeEqual(expectedBuf, providedBuf);
}
