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
 * Primary left navigation with brand mark and readable section/nav titles.
 * Labels stay visible whenever the sidebar is expanded (default desk layout).
 */
export function AppSidebar({
  active,
  isAdmin,
  collapsed,
  onNavigate,
  onCollapseToggle,
}: AppSidebarProps) {
  const items = getPrimaryNav(isAdmin);
  const workspace = items.filter(
    (i) => i.key !== "admin" && i.key !== "profile",
  );
  const system = items.filter((i) => i.key === "profile" || i.key === "admin");

  return (
    <nav
      className={cn(
        "flex h-full flex-col border-r border-[var(--desk-border)] bg-[var(--desk-sidebar)] px-3 py-4",
        collapsed ? "w-[68px]" : "w-[220px]",
      )}
      aria-label="Primary navigation"
    >
      <div
        className={cn(
          "mb-5 flex items-center gap-2.5 px-2",
          collapsed && "justify-center px-0",
        )}
      >
        <span
          aria-hidden
          className="brand-mark relative size-7 shrink-0 rounded-md"
        />
        {!collapsed ? (
          <div className="min-w-0">
            <p className="font-mono text-[0.62rem] font-semibold tracking-[0.16em] text-[var(--desk-text-dim)] uppercase">
              Trading desk
            </p>
            <p className="truncate text-[0.95rem] font-bold tracking-tight text-[var(--desk-text)]">
              Catalyst Intel
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-4">
        <NavSection
          label="Workspace"
          items={workspace}
          active={active}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
        {system.length > 0 ? (
          <NavSection
            label="System"
            items={system}
            active={active}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ) : null}
      </div>

      {onCollapseToggle ? (
        <div className="mt-2 border-t border-[var(--desk-border)] pt-3">
          <button
            type="button"
            onClick={onCollapseToggle}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[0.86rem] font-medium text-[var(--desk-text-dim)] transition-colors hover:bg-white/[0.04] hover:text-[var(--desk-text-muted)]",
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

function NavSection({
  label,
  items,
  active,
  collapsed,
  onNavigate,
}: {
  label: string;
  items: NavItem[];
  active: NavKey;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {!collapsed ? (
        <p className="px-2.5 pb-1 font-mono text-[0.62rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
          {label}
        </p>
      ) : null}
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
    "group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[0.86rem] font-medium transition-colors";

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
            <span className="ml-auto rounded border border-[var(--desk-border-strong)] px-1.5 py-0.5 font-mono text-[0.62rem] tracking-wide text-[var(--desk-text-dim)] uppercase">
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
          ? "bg-white/[0.07] text-[var(--desk-text)] shadow-[inset_2px_0_0_var(--desk-live)]"
          : "text-[var(--desk-text-muted)] hover:bg-white/[0.04] hover:text-[var(--desk-text)]",
      )}
    >
      <Icon className="size-[17px] shrink-0 opacity-90" />
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
    </Link>
  );
}
