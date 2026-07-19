import posthog from "posthog-js";

import { getPostHogHost, isPostHogConfigured } from "@/lib/posthog/env";

/**
 * Client-side PostHog init (Next.js instrumentation-client convention).
 * Skips entirely when NEXT_PUBLIC_POSTHOG_KEY is missing so the app never crashes.
 * Pageviews on App Router navigations are handled by PostHogPageView.
 */
if (isPostHogConfigured()) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: getPostHogHost(),
    defaults: "2026-05-30",
    // Manual $pageview via PostHogPageView so soft navigations are captured once.
    capture_pageview: false,
    capture_pageleave: true,
  });
}
