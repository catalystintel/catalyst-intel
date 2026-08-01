import { redirect } from "next/navigation";

/** Reports is Coming Soon in the sidebar — deep links go to the Catalyst blotter. */
export default function ReportsPage() {
  redirect("/catalyst-feed");
}
