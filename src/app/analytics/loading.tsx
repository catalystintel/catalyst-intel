import { AppChromeSkeleton, SkeletonCard } from "@/components/loading-skeleton";

/**
 * Instant fallback for `/analytics`, mirroring dashboard/loading.tsx's
 * pattern - shown immediately on sidebar navigation, before the Server
 * Component's DB-backed auth check resolves.
 */
export default function AnalyticsLoading() {
  return (
    <AppChromeSkeleton>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} lines={1} />
          ))}
        </div>
        <SkeletonCard lines={5} />
        <SkeletonCard lines={5} />
      </div>
    </AppChromeSkeleton>
  );
}
