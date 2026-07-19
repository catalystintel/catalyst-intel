"use client";

import { PostHogProvider as PHProvider } from "@posthog/react";
import { Suspense, type ReactNode } from "react";
import posthog from "posthog-js";

import { PostHogPageView } from "@/components/posthog-pageview";
import { isPostHogConfigured } from "@/lib/posthog/env";

/**
 * Wraps the app with @posthog/react when a key is present.
 * Without a key, children render unchanged (analytics no-op).
 */
export function PostHogProvider({ children }: { children: ReactNode }) {
  if (!isPostHogConfigured()) {
    return <>{children}</>;
  }

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  );
}
