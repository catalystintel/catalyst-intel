"use client";

import { useRouter } from "next/navigation";

/**
 * Inline recovery UI when article SSR soft-fails (Turso blip / budget).
 * Prefer this over throwing into `error.tsx`, which mislabels timeouts as
 * "Database temporarily unreachable".
 */
export function ArticleLoadError({ catalystId }: { catalystId: number }) {
  const router = useRouter();

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg rounded-lg border border-border p-6 text-sm">
        <h1 className="text-base font-semibold tracking-tight">
          Could not load this article
        </h1>
        <p className="mt-2 text-muted-foreground">
          The desk is up, but this catalyst&apos;s details didn&apos;t arrive in
          time. Retry usually works — this is a brief hitch, not a setup
          problem.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => router.refresh()}
            className="text-sm font-medium underline underline-offset-2"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="text-sm font-medium text-muted-foreground underline underline-offset-2"
          >
            Back to Catalyst Feed
          </button>
          <span className="font-mono text-xs text-muted-foreground">
            #{catalystId}
          </span>
        </div>
      </div>
    </div>
  );
}
