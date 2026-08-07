import { AlertsPageSkeleton } from "@/components/alerts-page-skeleton";

/** Content-only fallback — desk layout keeps real AppShell chrome mounted. */
export default function AlertsLoading() {
  return <AlertsPageSkeleton />;
}
