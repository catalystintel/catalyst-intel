import {
  Bell,
  Bookmark,
  ChartNoAxesCombined,
  LayoutDashboard,
  Newspaper,
  Settings,
  Star,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/** Stable identifier for the active nav entry, passed by each page. */
export type NavKey =
  | "live"
  | "news"
  | "watchlist"
  | "alerts"
  | "reports"
  | "analytics"
  | "admin"
  | "profile";

export interface NavItem {
  key: NavKey;
  label: string;
  icon: LucideIcon;
  /** Present when the destination is live; omitted for coming-soon entries. */
  href?: string;
  comingSoon?: boolean;
  adminOnly?: boolean;
  /**
   * One-line teaser shown on hover for `comingSoon` entries, so "Soon" reads
   * as a preview of what's next rather than a dead end (see `SidebarEntry`'s
   * `title` attribute in app-sidebar.tsx).
   */
  comingSoonHint?: string;
}

const PRIMARY_NAV: NavItem[] = [
  {
    key: "live",
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
  },
  {
    key: "news",
    label: "News Feed",
    icon: Newspaper,
    comingSoon: true,
    comingSoonHint: "A dedicated headline stream, separate from the tape.",
  },
  { key: "alerts", label: "Alerts", icon: Bell, href: "/alerts" },
  { key: "watchlist", label: "Watchlists", icon: Star, href: "/watchlist" },
  {
    key: "reports",
    label: "Reports",
    icon: Bookmark,
    comingSoon: true,
    comingSoonHint: "Saved, shareable digests of catalysts you're tracking.",
  },
  {
    key: "analytics",
    label: "Analytics",
    icon: ChartNoAxesCombined,
    href: "/analytics",
  },
  { key: "profile", label: "Settings", icon: Settings, href: "/profile" },
];

const ADMIN_NAV: NavItem = {
  key: "admin",
  label: "Admin",
  icon: Wrench,
  href: "/admin",
  adminOnly: true,
};

/**
 * Builds the sidebar's primary nav, appending the admin entry only for admins.
 *
 * @param isAdmin - Whether the current user is on the admin allowlist.
 * @returns Ordered nav items for the sidebar.
 */
export function getPrimaryNav(isAdmin: boolean): NavItem[] {
  return isAdmin ? [...PRIMARY_NAV, ADMIN_NAV] : PRIMARY_NAV;
}

/** Resolve active nav key from the current URL (shared desk layout). */
export function navKeyFromPathname(pathname: string | null): NavKey {
  if (!pathname) return "live";
  if (pathname.startsWith("/dashboard")) return "live";
  if (pathname.startsWith("/analytics")) return "analytics";
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/alerts")) return "alerts";
  if (pathname.startsWith("/watchlist")) return "watchlist";
  if (pathname.startsWith("/profile")) return "profile";
  return "live";
}
