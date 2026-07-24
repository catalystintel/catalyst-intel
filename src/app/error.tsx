"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

import { classifyDbError } from "@/lib/errors/classify-db-error";
import { isPostHogConfigured } from "@/lib/posthog/env";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    if (isPostHogConfigured()) {
      try {
        posthog.captureException(error);
      } catch {
        // Observability must never break the error UI.
      }
    }
  }, [error]);

  const dbErrorKind = classifyDbError(error.message);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg rounded-lg border border-border p-6 text-sm">
        <h1 className="text-base font-semibold tracking-tight">
          {dbErrorKind === "not-configured"
            ? "Database not configured"
            : dbErrorKind === "transient"
              ? "Database temporarily unreachable"
              : "Something went wrong"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {dbErrorKind === "not-configured"
            ? "This deployment needs a hosted Turso database. Set LIBSQL_URL and LIBSQL_AUTH_TOKEN in Vercel, migrate, and redeploy (see DEPLOYMENT.md)."
            : dbErrorKind === "transient"
              ? "This looks like a brief connection hiccup to the database, not a configuration problem. Please try again in a moment."
              : "An unexpected error occurred. Try again, and if it keeps happening check Vercel logs / PostHog exceptions."}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 text-sm font-medium underline underline-offset-2"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
