import {
  AppChromeSkeleton,
  Skeleton,
  SkeletonCard,
} from "@/components/loading-skeleton";

/** Instant fallback for an article page while it streams in from the server. */
export default function CatalystArticleLoading() {
  return (
    <AppChromeSkeleton>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 overflow-hidden p-4 sm:p-5">
        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-7 w-full max-w-xl" />
          <Skeleton className="h-3.5 w-52" />
        </div>
        <Skeleton className="h-44 w-full rounded-xl" />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={2} />
      </div>
    </AppChromeSkeleton>
  );
}
