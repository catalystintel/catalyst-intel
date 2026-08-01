import { redirect } from "next/navigation";

/** Shared report links are paused while Reports is Coming Soon. */
export default function SharedReportPage() {
  redirect("/catalyst-feed");
}
