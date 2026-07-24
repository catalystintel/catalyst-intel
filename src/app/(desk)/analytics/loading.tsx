import { SkeletonCard } from "@/components/loading-skeleton";

/**
 * Content-only fallback — desk layout keeps real AppShell chrome mounted.
 */
export default function AnalyticsLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4 sm:p-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} lines={1} />
        ))}
      </div>
      <SkeletonCard lines={5} />
      <SkeletonCard lines={5} />
    </div>
  );
}
