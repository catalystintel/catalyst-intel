"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { AccountMenu } from "@/components/account-menu";
import { AppSidebar } from "@/components/app-sidebar";
import { cn } from "@/lib/utils";
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
 * App chrome for authenticated pages: collapsible left sidebar, a slim top bar
 * with the brand and account menu, and a scrollable content region.
 *
 * @param user - Current user identity for the account menu and admin gating.
 * @param active - Active nav key for sidebar highlighting.
 * @param children - Page content rendered in the main region.
 * @returns The full application shell.
 */
export function AppShell({ user, active, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="hidden md:block">
        <div className="sticky top-0 h-dvh">
          <AppSidebar
            active={active}
            isAdmin={user.isAdmin}
            collapsed={collapsed}
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
          <div className="absolute inset-y-0 left-0">
            <AppSidebar
              active={active}
              isAdmin={user.isAdmin}
              collapsed={false}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <div className="desk-shell flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-12 items-center justify-between gap-3 border-b border-border/70 bg-[oklch(0.15_0.015_255_/0.92)] px-3 backdrop-blur-md sm:px-5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
              className="btn-press rounded-md border border-transparent p-1.5 text-muted-foreground hover:border-border/70 hover:bg-muted/40 md:hidden"
            >
              <Menu className="size-4" />
            </button>
            <button
              type="button"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => setCollapsed((prev) => !prev)}
              className="btn-press hidden rounded-md border border-transparent p-1.5 text-muted-foreground hover:border-border/70 hover:bg-muted/40 md:block"
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </button>
            <Link
              href="/dashboard"
              className="group flex items-center gap-2 text-sm font-semibold tracking-tight transition-colors hover:text-amber-300"
            >
              <span
                aria-hidden
                className={cn(
                  "inline-block size-2 rounded-full bg-amber-400",
                  active === "live" && "live-pulse",
                )}
              />
              <span>Catalyst Intel</span>
            </Link>
          </div>

          <AccountMenu
            email={user.email}
            displayName={user.displayName}
            avatarUrl={user.avatarUrl}
            isAdmin={user.isAdmin}
          />
        </header>

        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
