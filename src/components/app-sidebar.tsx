"use client";

import Link from "next/link";

import { getPrimaryNav, type NavItem, type NavKey } from "@/lib/nav/nav-items";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  active: NavKey;
  isAdmin: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}

/**
 * Primary left navigation. Live entries link out; coming-soon entries render
 * as disabled with a "Soon" pill so the roadmap is visible but inert.
 *
 * @param active - The current page's nav key, for highlighting.
 * @param isAdmin - Whether to include the admin entry.
 * @param collapsed - Icon-only rail when true (desktop toggle).
 * @param onNavigate - Called after a link click, e.g. to close the mobile drawer.
 * @returns The sidebar navigation element.
 */
export function AppSidebar({
  active,
  isAdmin,
  collapsed,
  onNavigate,
}: AppSidebarProps) {
  const items = getPrimaryNav(isAdmin);

  return (
    <nav
      className={cn(
        "flex h-full flex-col gap-1 border-r border-border/70 bg-[oklch(0.16_0.016_255)] p-2",
        collapsed ? "w-14" : "w-56",
      )}
      aria-label="Primary"
    >
      {items.map((item) => (
        <SidebarEntry
          key={item.key}
          item={item}
          active={item.key === active}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

function SidebarEntry({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const base =
    "group relative flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors";

  if (item.comingSoon || !item.href) {
    return (
      <span
        aria-disabled
        title={collapsed ? `${item.label} · coming soon` : undefined}
        className={cn(
          base,
          "cursor-not-allowed text-muted-foreground/45 select-none",
        )}
      >
        <Icon className="size-4 shrink-0" />
        {!collapsed ? (
          <>
            <span className="truncate">{item.label}</span>
            <span className="ml-auto rounded-sm border border-border/60 px-1.5 py-0.5 font-mono text-[0.55rem] tracking-[0.1em] text-muted-foreground/70 uppercase">
              Soon
            </span>
          </>
        ) : null}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        base,
        active
          ? "bg-amber-400/12 text-amber-200"
          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
    </Link>
  );
}
