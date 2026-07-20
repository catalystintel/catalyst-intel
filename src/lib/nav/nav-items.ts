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
}

const PRIMARY_NAV: NavItem[] = [
  {
    key: "live",
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
  },
  { key: "news", label: "News Feed", icon: Newspaper, comingSoon: true },
  { key: "alerts", label: "Alerts", icon: Bell, comingSoon: true },
  { key: "watchlist", label: "Watchlists", icon: Star, comingSoon: true },
  { key: "reports", label: "Reports", icon: Bookmark, comingSoon: true },
  {
    key: "analytics",
    label: "Analytics",
    icon: ChartNoAxesCombined,
    comingSoon: true,
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
