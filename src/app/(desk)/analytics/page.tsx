import { redirect } from "next/navigation";

/** Analytics is Coming Soon in the sidebar — deep links go to the Catalyst blotter. */
export default function AnalyticsPage() {
  redirect("/catalyst-feed");
}
