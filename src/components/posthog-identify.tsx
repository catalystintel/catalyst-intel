"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

export function PostHogIdentify({
  supabaseUserId,
  email,
  role,
  subscription,
}: {
  supabaseUserId: string;
  email: string;
  role: "user" | "admin";
  subscription: "free" | "pro";
}) {
  useEffect(() => {
    posthog.identify(supabaseUserId, { email, role, subscription });
  }, [supabaseUserId, email, role, subscription]);

  return null;
}
