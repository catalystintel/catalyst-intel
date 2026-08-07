import { SkeletonCard } from "@/components/loading-skeleton";

/**
 * Instant alerts-route placeholder. Matches the real page chrome (Away desk /
 * Alert rules copy) plus the same three cards `AlertRulesPanel` shows while
 * fetching — so route `loading.tsx` and the client fetch state look identical
 * and do not flash a different skeleton.
 */
export function AlertsPageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 sm:p-5">
      <div className="border-b border-[var(--desk-border)] pb-5">
        <p className="font-mono text-[0.65rem] tracking-[0.2em] text-[var(--desk-live)] uppercase">
          Away desk
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-[var(--desk-text)] sm:text-2xl">
          Alert rules
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--desk-text-muted)]">
          Get material catalysts when you are away from the tape. Pick Push,
          Telegram, or email — each channel has a short setup checklist. Choose
          which sessions (pre-market, regular hours, after-hours) can fire.
          After you save a rule, use{" "}
          <span className="text-[var(--desk-text)]">Test</span> to fire against
          the latest catalyst and confirm delivery.
        </p>
      </div>
      <AlertRulesListSkeleton />
    </div>
  );
}

/** Card stack used while alert rules are fetching. */
export function AlertRulesListSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <SkeletonCard lines={2} />
      <SkeletonCard lines={4} />
      <SkeletonCard lines={2} />
    </div>
  );
}
