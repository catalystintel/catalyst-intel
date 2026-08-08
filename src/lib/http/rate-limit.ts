/**
 * Simple fixed-window rate limiter (in-memory).
 *
 * Fine for a single Node/Vercel isolate. Multi-instance production will need
 * a shared store (e.g. Upstash Redis) later — document that in DEPLOYMENT.md.
 *
 * Not suitable as a security boundary against determined distributed abuse;
 * it stops casual spam and accidental poll storms from one IP.
 */

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  /** Epoch ms when the current window resets. */
  resetAt: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

/** Exposed for tests — clears all windows. */
export function resetRateLimitStore() {
  buckets.clear();
}

export function checkRateLimit(options: {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
}): RateLimitResult {
  const now = options.now ?? Date.now();
  const existing = buckets.get(options.key);

  if (!existing || now >= existing.resetAt) {
    const resetAt = now + options.windowMs;
    buckets.set(options.key, { count: 1, resetAt });
    return {
      ok: true,
      limit: options.limit,
      remaining: Math.max(0, options.limit - 1),
      resetAt,
    };
  }

  if (existing.count >= options.limit) {
    return {
      ok: false,
      limit: options.limit,
      remaining: 0,
      resetAt: existing.resetAt,
    };
  }

  existing.count += 1;
  return {
    ok: true,
    limit: options.limit,
    remaining: Math.max(0, options.limit - existing.count),
    resetAt: existing.resetAt,
  };
}

/** Presets tuned for a trading feed: loose reads, strict admin writes. */
export const RATE_LIMITS = {
  /** Soft-refetch / Live feed polling. */
  catalystsRead: { limit: 90, windowMs: 60_000 },
  /** On-demand AI analysis — LLM call is expensive; keep tight. */
  catalystsAnalyze: { limit: 12, windowMs: 60_000 },
  /** Analytics dashboard - fetched on load + window-selector clicks, not polled. */
  analyticsRead: { limit: 30, windowMs: 60_000 },
  /** Manual SEC fetch from the admin UI (cron bypasses separately). */
  adminWrite: { limit: 6, windowMs: 60_000 },
  /** Watchlist / playbook / alert-rule mutations. */
  userWrite: { limit: 30, windowMs: 60_000 },
  /** Telegram link status / health probes (polled ~every 45s on /alerts). */
  telegramLinkRead: { limit: 60, windowMs: 60_000 },
  /** Alert test-fire (webhook/email). */
  alertTest: { limit: 10, windowMs: 60_000 },
  /** AI watchlist drafting/refining — LLM call is expensive; keep tight. */
  watchlistsAiDraft: { limit: 10, windowMs: 60_000 },
  /** Product feedback form (emails the team inbox). */
  feedback: { limit: 8, windowMs: 60_000 },
  /** Prelogin guest ticker search (cookie + IP). */
  guestSearch: { limit: 20, windowMs: 60_000 },
} as const;
