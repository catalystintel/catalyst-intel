import {
  AppChromeSkeleton,
  SkeletonFeedRows,
} from "@/components/loading-skeleton";

/**
 * Instant fallback for `/dashboard`. Next.js shows this immediately on
 * sidebar navigation (before the Server Component's DB query resolves),
 * so the sidebar click feels instant instead of freezing the old page.
 */
export default function DashboardLoading() {
  return (
    <AppChromeSkeleton>
      <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-5">
        <SkeletonFeedRows />
      </div>
    </AppChromeSkeleton>
  );
}
