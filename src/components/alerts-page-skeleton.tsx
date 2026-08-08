import { SkeletonCard } from "@/components/loading-skeleton";

/**
 * Instant alerts-route placeholder. Matches the notifications stepper chrome.
 */
export function AlertsPageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 sm:p-5">
      <div className="border-b border-[var(--desk-border)] pb-5">
        <p className="font-mono text-[0.65rem] tracking-[0.2em] text-[var(--desk-live)] uppercase">
          Away desk
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-[var(--desk-text)] sm:text-2xl">
          Notifications
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--desk-text-muted)]">
          Pick how you want to be reached, attach the watchlists that matter,
          and we&apos;ll fire when matching catalysts hit.
        </p>
      </div>
      <AlertRulesListSkeleton />
    </div>
  );
}

/** Card stack used while notification settings are fetching. */
export function AlertRulesListSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <SkeletonCard lines={1} />
        <SkeletonCard lines={1} />
        <SkeletonCard lines={1} />
      </div>
      <SkeletonCard lines={5} />
    </div>
  );
}
