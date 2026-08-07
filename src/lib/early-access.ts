/**
 * Open Early Access — the free launch window while we grow traffic and learn
 * from desks. Paid Pro gating comes later; do not revoke access yet.
 */
export const EARLY_ACCESS = {
  /** Public name for this period (prefer over “beta” / “test run”). */
  label: "Open Early Access",
  /** Short chip / badge text. */
  badge: "Open Early Access",
  /** One-line promise shown in top banners and hero. */
  headline: "Every feature is free during Open Early Access",
  /** Supporting line for marketing hero / about. */
  detail:
    "Sign in and use the full desk — feed, alerts, watchlists, playbook, and AI — at no cost while we build with early traders.",
  /** Compact in-app banner line. */
  banner: "Open Early Access — all features free",
  /** Profile / plan note until billing ships. */
  planNote:
    "You have full access during Open Early Access. Paid Pro plans come later.",
} as const;

export const FEEDBACK_CATEGORIES = [
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature request" },
  { value: "improvement", label: "Improvement" },
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]["value"];

/** Max length for the feedback note (UI + API). Short on purpose. */
export const FEEDBACK_MESSAGE_MAX_CHARS = 800;

export function isFeedbackCategory(value: string): value is FeedbackCategory {
  return FEEDBACK_CATEGORIES.some((c) => c.value === value);
}
