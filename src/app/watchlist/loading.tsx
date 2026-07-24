import {
  AppChromeSkeleton,
  SkeletonCard,
  SkeletonHeading,
} from "@/components/loading-skeleton";

/** Instant fallback for `/watchlist` while its data resolves. */
export default function WatchlistLoading() {
  return (
    <AppChromeSkeleton>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 overflow-hidden p-4 sm:p-5">
        <SkeletonHeading />
        <SkeletonCard lines={4} />
      </div>
    </AppChromeSkeleton>
  );
}
