"use client";

import { useRef, useState, type ReactNode } from "react";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { AccountMenu } from "@/components/account-menu";
import { AppSidebar } from "@/components/app-sidebar";
import { LiveHeaderStatus } from "@/components/live-header-status";
import { useAutoFocusScrollRegion } from "@/hooks/use-auto-focus-scroll-region";
import type { NavKey } from "@/lib/nav/nav-items";

interface AppShellUser {
  email: string;
  isAdmin: boolean;
  displayName?: string | null;
  avatarUrl?: string | null;
}

interface AppShellProps {
  user: AppShellUser;
  active: NavKey;
  children: ReactNode;
}

/**
 * App chrome for authenticated pages: collapsible left sidebar, LIVE top bar,
 * account menu, and a scrollable content region.
 */
export function AppShell({ user, active, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mainRef = useRef<HTMLElement | null>(null);
  useAutoFocusScrollRegion(mainRef);

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 flex-1 overflow-hidden overscroll-none bg-[var(--desk-app)]">
      <aside className="hidden md:block">
        <div className="sticky top-0 h-full max-h-dvh">
          <AppSidebar
            active={active}
            isAdmin={user.isAdmin}
            collapsed={collapsed}
            onCollapseToggle={() => setCollapsed((prev) => !prev)}
          />
        </div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/55"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 max-w-[min(212px,85vw)] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
            <AppSidebar
              active={active}
              isAdmin={user.isAdmin}
              collapsed={false}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-[var(--desk-border)] bg-[var(--desk-header)]/95 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-sm sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
              className="inline-flex size-11 items-center justify-center rounded-lg text-[var(--desk-text-muted)] transition-colors hover:bg-white/[0.05] hover:text-[var(--desk-text)] md:hidden"
            >
              <Menu className="size-5" />
            </button>
            <button
              type="button"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => setCollapsed((prev) => !prev)}
              className="hidden rounded-lg p-1.5 text-[var(--desk-text-muted)] transition-colors hover:bg-white/[0.05] hover:text-[var(--desk-text)] md:block"
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </button>
            {active === "live" ? (
              <LiveHeaderStatus />
            ) : (
              <span className="truncate text-sm font-semibold tracking-tight text-[var(--desk-text)]">
                Catalyst Intel
              </span>
            )}
          </div>

          <AccountMenu
            email={user.email}
            displayName={user.displayName}
            avatarUrl={user.avatarUrl}
            isAdmin={user.isAdmin}
          />
        </header>

        {/*
          overflow-y-auto (not overflow-hidden) makes this the scroll
          container for pages whose content is taller than the viewport
          (e.g. /admin, /profile). Pages that manage their own internal
          scroll region (e.g. the Live feed) already size to 100% of this
          element via flex + min-h-0, so they aren't affected.

          tabIndex=-1 (focusable via script, not via Tab) + the auto-focus
          above is what makes Page Up/Down/Home/End work as soon as a page
          loads - without a focused element, those keys have nothing to
          scroll (see use-auto-focus-scroll-region.ts).
        */}
        <main
          ref={mainRef}
          tabIndex={-1}
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain outline-none"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
