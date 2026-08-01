"use client";

import Link, { useLinkStatus } from "next/link";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

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
 * Collapsed mode is an icon rail: square centered hits, no label/hint shift.
 */
export function AppSidebar({
  active,
  isAdmin,
  collapsed,
  onNavigate,
  onCollapseToggle,
}: AppSidebarProps) {
  const items = getPrimaryNav(isAdmin);
  // Workspace = everyone. System = admin console only (settings are in the
  // account menu, so non-admins never see a System section).
  const workspace = items.filter((i) => !i.adminOnly);
  const system = items.filter((i) => i.adminOnly);

  return (
    <nav
      className={cn(
        "flex h-full flex-col border-r border-[var(--desk-border)] bg-[var(--desk-sidebar)] py-4",
        collapsed ? "w-[56px] items-center px-1.5" : "w-[220px] px-3",
      )}
      aria-label="Primary navigation"
    >
      <Link
        href="/catalyst-feed"
        onClick={onNavigate}
        aria-label="Catalyst Intel home"
        title="Back to Catalyst Feed"
        className={cn(
          "mb-5 flex items-center gap-2.5 rounded-md transition-colors",
          "hover:bg-[var(--desk-overlay-soft)] focus-visible:bg-[var(--desk-overlay-soft)] focus-visible:outline-none",
          collapsed ? "justify-center p-1.5" : "px-2 py-1",
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
            <p className="marketing-headline truncate text-[0.95rem] text-[var(--desk-text)]">
              Catalyst Intel
            </p>
          </div>
        ) : null}
      </Link>

      <div
        className={cn(
          "flex flex-1 flex-col",
          collapsed ? "w-full items-center gap-1" : "gap-4",
        )}
      >
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
        <div
          className={cn(
            "mt-2 border-t border-[var(--desk-border)] pt-3",
            collapsed && "w-full",
          )}
        >
          <button
            type="button"
            onClick={onCollapseToggle}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex items-center gap-2.5 rounded-md text-[0.86rem] font-medium text-[var(--desk-text-dim)] transition-colors hover:bg-[var(--desk-overlay-soft)] hover:text-[var(--desk-text-muted)]",
              collapsed
                ? "mx-auto size-9 justify-center"
                : "w-full px-2.5 py-2",
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-[17px] shrink-0" />
            ) : (
              <>
                <PanelLeftClose className="size-[17px] shrink-0" />
                <span>Collapse</span>
              </>
            )}
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
    <div
      className={cn(
        "flex flex-col",
        collapsed ? "w-full items-center gap-0.5" : "gap-0.5",
      )}
    >
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
  const base = cn(
    "group relative flex items-center rounded-md text-[0.86rem] font-medium transition-colors",
    collapsed ? "size-9 shrink-0 justify-center" : "w-full gap-2.5 px-2.5 py-2",
  );

  if (item.comingSoon || !item.href) {
    const hint = item.comingSoonHint
      ? `${item.label} · coming soon — ${item.comingSoonHint}`
      : `${item.label} · coming soon`;
    return (
      <span
        aria-disabled
        title={hint}
        className={cn(
          base,
          "cursor-default text-[var(--desk-text-dim)] select-none",
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
        active
          ? cn(
              "bg-[var(--desk-overlay-strong)] text-[var(--desk-text)]",
              !collapsed && "shadow-[inset_2px_0_0_var(--desk-live)]",
              collapsed && "ring-1 ring-[var(--desk-live)]/55 ring-inset",
            )
          : "text-[var(--desk-text-muted)] hover:bg-[var(--desk-overlay-soft)] hover:text-[var(--desk-text)]",
      )}
    >
      <Icon className="size-[17px] shrink-0 opacity-90" />
      {!collapsed ? (
        <>
          <span className="truncate">{item.label}</span>
          <NavPendingHint />
        </>
      ) : (
        <NavPendingHint collapsed />
      )}
    </Link>
  );
}

/**
 * Fixed-size dot that fades in only once a click's navigation has been
 * pending for a moment - confirms the click landed even on the rare
 * destination that isn't fully prefetched yet, without adding layout shift
 * or flashing on the common instant case (see `useLinkStatus` docs).
 */
function NavPendingHint({ collapsed = false }: { collapsed?: boolean }) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cn(
        "nav-pending-hint size-1.5 shrink-0 rounded-full bg-[var(--desk-live)]",
        collapsed
          ? "pointer-events-none absolute top-1.5 right-1.5"
          : "ml-auto",
        pending && "nav-pending-hint-active",
      )}
    />
  );
}
