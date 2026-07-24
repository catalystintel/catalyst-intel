import posthog from "posthog-js";

import {
  getPostHogHost,
  getPostHogKey,
  isPostHogConfigured,
} from "@/lib/posthog/env";

/**
 * Client-side PostHog init (Next.js instrumentation-client convention).
 * Skips entirely when the public key is missing so the app never crashes.
 * Pageviews on App Router navigations are handled by PostHogPageView.
 */
if (isPostHogConfigured()) {
  posthog.init(getPostHogKey(), {
    api_host: getPostHogHost(),
    defaults: "2026-05-30",
    // Manual $pageview via PostHogPageView so soft navigations are captured once.
    capture_pageview: false,
    capture_pageleave: true,
    // Capture unhandled window errors / promise rejections into PostHog Error tracking.
    capture_exceptions: true,
  });
}
