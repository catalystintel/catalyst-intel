import { NextResponse } from "next/server";

import type { RateLimitResult } from "./rate-limit";

export function rateLimitExceededResponse(result: RateLimitResult) {
  const retryAfterSec = Math.max(
    1,
    Math.ceil((result.resetAt - Date.now()) / 1000),
  );

  return NextResponse.json(
    {
      error: "Too many requests. Slow down and try again.",
      retryAfterSec,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
      },
    },
  );
}

export function withRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult,
) {
  response.headers.set("X-RateLimit-Limit", String(result.limit));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set(
    "X-RateLimit-Reset",
    String(Math.ceil(result.resetAt / 1000)),
  );
  return response;
}
