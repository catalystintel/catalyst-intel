import { Skeleton, SkeletonCard } from "@/components/loading-skeleton";

/**
 * Content-only fallback while an article streams in.
 * The shared `(desk)` layout keeps the real AppShell chrome mounted.
 */
export default function CatalystArticleLoading() {
  return (
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
  );
}
