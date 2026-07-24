import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Shimmering placeholder block. Building block for route `loading.tsx`
 * fallbacks - never carries real data, just communicates "content is on
 * its way" the instant a nav click happens (before the real Server
 * Component has resolved).
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "skeleton-shimmer rounded-md bg-[var(--desk-overlay-strong)]",
        className,
      )}
    />
  );
}

/**
 * @deprecated Prefer the shared `(desk)` layout + content-only `loading.tsx`.
 * Kept for any non-desk surfaces that still need a full-frame placeholder.
 */
export function AppChromeSkeleton({ children }: { children: ReactNode }) {
  return (
    <div className="page-enter flex h-dvh max-h-dvh min-h-0 flex-1 overflow-hidden bg-[var(--desk-app)]">
      <aside className="hidden h-full w-[220px] shrink-0 flex-col gap-4 border-r border-[var(--desk-border)] bg-[var(--desk-sidebar)] px-3 py-4 md:flex">
        <div className="mb-2 flex items-center gap-2.5 px-2">
          <span className="brand-mark relative size-7 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-2 w-16" />
            <Skeleton className="mt-1.5 h-3 w-24" />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--desk-border)] bg-[var(--desk-header)]/95 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 sm:px-5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="size-8 rounded-full" />
        </header>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

/** Skeleton for a title + a couple of description lines. */
export function SkeletonHeading({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-6 w-56" />
      <Skeleton className="h-3.5 w-80 max-w-full" />
    </div>
  );
}

/** Skeleton for a bordered content card, e.g. an admin/profile panel. */
export function SkeletonCard({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)] p-5",
        className,
      )}
    >
      <Skeleton className="h-4 w-36" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-3 w-full max-w-md" />
      ))}
    </div>
  );
}

/** Skeleton for the Live tape's tabular rows. */
export function SkeletonFeedRows({ count = 10 }: { count?: number }) {
  return (
    <section className="news-panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--desk-border)] bg-[var(--desk-header)] px-4 py-3.5 sm:px-5">
        <Skeleton className="h-5 w-24" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-28 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>
      <div className="flex flex-1 flex-col divide-y divide-[var(--desk-border)] px-4 sm:px-5">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-3.5">
            <Skeleton className="h-3.5 flex-1" />
            <Skeleton className="hidden h-3.5 w-16 sm:block" />
            <Skeleton className="hidden h-3.5 w-14 sm:block" />
            <Skeleton className="hidden h-3.5 w-12 sm:block" />
          </div>
        ))}
      </div>
    </section>
  );
}
