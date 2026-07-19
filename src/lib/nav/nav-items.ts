import {
  Bell,
  CalendarClock,
  ChartNoAxesCombined,
  Radio,
  SlidersHorizontal,
  Star,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/** Stable identifier for the active nav entry, passed by each page. */
export type NavKey =
  | "live"
  | "watchlist"
  | "screener"
  | "alerts"
  | "calendar"
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
  { key: "live", label: "Live feed", icon: Radio, href: "/dashboard" },
  { key: "watchlist", label: "Watchlist", icon: Star, comingSoon: true },
  {
    key: "screener",
    label: "Screener",
    icon: SlidersHorizontal,
    comingSoon: true,
  },
  { key: "alerts", label: "Alerts", icon: Bell, comingSoon: true },
  { key: "calendar", label: "Calendar", icon: CalendarClock, comingSoon: true },
  {
    key: "analytics",
    label: "Analytics",
    icon: ChartNoAxesCombined,
    comingSoon: true,
  },
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
