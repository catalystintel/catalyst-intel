import { PostHog } from "posthog-node";

import {
  getPostHogHost,
  getPostHogKey,
  isPostHogConfigured,
} from "@/lib/posthog/env";

/** Server-side PostHog client. Callers should check isPostHogServerConfigured first. */
export function getPostHogClient(): PostHog {
  return new PostHog(getPostHogKey(), {
    host: getPostHogHost(),
    flushAt: 1,
    flushInterval: 0,
  });
}

export function isPostHogServerConfigured(): boolean {
  return isPostHogConfigured();
}
