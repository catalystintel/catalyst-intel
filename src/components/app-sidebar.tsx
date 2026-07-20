"use client";

import Link from "next/link";
import { PanelLeftClose } from "lucide-react";

import { getPrimaryNav, type NavItem, type NavKey } from "@/lib/nav/nav-items";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  active: NavKey;
  isAdmin: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
  onCollapseToggle?: () => void;
}

/**
 * Primary left navigation with brand mark. Live entries link out; coming-soon
 * entries render as disabled with a count-style badge when provided.
 */
export function AppSidebar({
  active,
  isAdmin,
  collapsed,
  onNavigate,
  onCollapseToggle,
}: AppSidebarProps) {
  const items = getPrimaryNav(isAdmin);

  return (
    <nav
      className={cn(
        "flex h-full flex-col border-r border-[var(--desk-border)] bg-[var(--desk-sidebar)] px-3 py-4",
        collapsed ? "w-[68px]" : "w-[212px]",
      )}
      aria-label="Primary navigation"
    >
      <div
        className={cn(
          "mb-4 flex items-center gap-2.5 px-2",
          collapsed && "justify-center px-0",
        )}
      >
        <span
          aria-hidden
          className="brand-mark relative size-7 shrink-0 rounded-lg"
        />
        {!collapsed ? (
          <span className="truncate text-[0.92rem] font-bold tracking-tight text-[var(--desk-text)]">
            Catalyst Intel
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-0.5">
        {items.map((item) => (
          <SidebarEntry
            key={item.key}
            item={item}
            active={item.key === active}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      {onCollapseToggle ? (
        <div className="mt-2 border-t border-[var(--desk-border)] pt-3">
          <button
            type="button"
            onClick={onCollapseToggle}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.86rem] font-medium text-[var(--desk-text-dim)] transition-colors hover:bg-white/[0.04] hover:text-[var(--desk-text-muted)]",
              collapsed && "justify-center px-0",
            )}
          >
            <PanelLeftClose className="size-[17px] shrink-0" />
            {!collapsed ? <span>Collapse</span> : null}
          </button>
        </div>
      ) : null}
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
    "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.86rem] font-medium transition-colors";

  if (item.comingSoon || !item.href) {
    return (
      <span
        aria-disabled
        title={collapsed ? `${item.label} · coming soon` : undefined}
        className={cn(
          base,
          "cursor-not-allowed text-[var(--desk-text-dim)] select-none",
          collapsed && "justify-center px-0",
        )}
      >
        <Icon className="size-[17px] shrink-0 opacity-90" />
        {!collapsed ? (
          <>
            <span className="truncate">{item.label}</span>
            <span className="ml-auto rounded-full bg-[#e07a2f] px-1.5 py-0.5 text-[0.68rem] font-bold text-white">
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
        collapsed && "justify-center px-0",
        active
          ? "bg-[var(--desk-nav-active)] text-[#8eb8ec] shadow-[inset_2px_0_0_#4f8fd9]"
          : "text-[var(--desk-text-muted)] hover:bg-white/[0.04] hover:text-[var(--desk-text-secondary)]",
      )}
    >
      <Icon className="size-[17px] shrink-0 opacity-90" />
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
    </Link>
  );
}
