import { redirect } from "next/navigation";

/** News Feed is unshipped for now — bookmarks land on the Catalyst blotter. */
export default function NewsFeedPage() {
  redirect("/catalyst-feed");
}
