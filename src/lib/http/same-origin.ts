/**
 * Same-origin checks for cookie-authenticated mutating API routes.
 * Browsers send `Origin` on cross-site POSTs; rejecting mismatched Origin
 * (or Referer) reduces CSRF risk beyond SameSite=Lax alone.
 */

import { NextResponse } from "next/server";

import { getRequestOrigin } from "@/lib/http/origin";

/**
 * Returns true when the request appears to come from this app's origin.
 * Allows missing Origin when Sec-Fetch-Site is same-origin/none (common for
 * same-site navigations and some older clients) if Referer also matches.
 */
export function isSameOriginRequest(request: Request): boolean {
  let expected: string;
  try {
    expected = getRequestOrigin(request.headers);
  } catch {
    return false;
  }

  const origin = request.headers.get("origin");
  if (origin) {
    return origin === expected;
  }

  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site") return false;

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin === expected;
    } catch {
      return false;
    }
  }

  // No Origin/Referer: allow only clearly same-origin fetch metadata.
  return site === "same-origin" || site === "none";
}

/** 403 JSON response for failed same-origin checks. */
export function sameOriginForbiddenResponse(): NextResponse {
  return NextResponse.json(
    { error: "Cross-origin request blocked." },
    { status: 403 },
  );
}
