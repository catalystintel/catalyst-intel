import { SkeletonCard, SkeletonHeading } from "@/components/loading-skeleton";

/** Content-only fallback — desk layout keeps real AppShell chrome mounted. */
export default function ProfileLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 overflow-hidden p-4 sm:p-5">
      <SkeletonHeading />
      <SkeletonCard lines={2} />
      <SkeletonCard lines={2} />
      <SkeletonCard lines={1} />
    </div>
  );
}
