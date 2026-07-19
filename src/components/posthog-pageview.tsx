"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import posthog from "posthog-js";

import { isPostHogConfigured } from "@/lib/posthog/env";

/**
 * Captures a $pageview on App Router client navigations (and the initial route).
 * Must be rendered inside a Suspense boundary because of useSearchParams.
 */
export function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isPostHogConfigured() || !pathname) return;

    let url = window.origin + pathname;
    const search = searchParams.toString();
    if (search) {
      url += `?${search}`;
    }

    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}
