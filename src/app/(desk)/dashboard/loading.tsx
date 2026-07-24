import { SkeletonFeedRows } from "@/components/loading-skeleton";

/**
 * Content-only fallback for `/dashboard`.
 * Dashboard layout keeps the real AppShell chrome mounted.
 */
export default function DashboardLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-5">
      <SkeletonFeedRows />
    </div>
  );
}
