import {
  AppChromeSkeleton,
  SkeletonCard,
  SkeletonHeading,
} from "@/components/loading-skeleton";

/** Instant fallback for `/profile` while its DB read resolves. */
export default function ProfileLoading() {
  return (
    <AppChromeSkeleton>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 overflow-hidden p-4 sm:p-5">
        <SkeletonHeading />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={1} />
      </div>
    </AppChromeSkeleton>
  );
}
