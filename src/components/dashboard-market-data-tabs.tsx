"use client";

import Link from "next/link";

import { getPrimaryNav, type NavKey } from "@/lib/nav/nav-items";
import { cn } from "@/lib/utils";

/**
 * Slim "MARKET DATA" tab strip above the Live tape — a quick-switch row
 * between the desk's real sections (Live / News / Watchlists / Analytics /
 * Alerts), echoing the reference dashboard's tab bar. These are real nav
 * links (`getPrimaryNav`), not decorative tabs — clicking one navigates to
 * that already-shipped page.
 */
export function DashboardMarketDataTabs({
  active,
  isAdmin,
}: {
  active: NavKey;
  isAdmin: boolean;
}) {
  const items = getPrimaryNav(isAdmin).filter(
    (item) => item.href && item.key !== "admin" && item.key !== "profile",
  );

  return (
    <div className="flex min-w-0 items-center gap-3 overflow-x-auto rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)] px-4 py-2.5 sm:px-5">
      <p className="shrink-0 font-mono text-[0.65rem] font-semibold tracking-[0.16em] text-[var(--desk-text-dim)] uppercase">
        Market Data
      </p>
      <nav
        aria-label="Desk quick switch"
        className="flex min-w-0 items-center gap-4 overflow-x-auto"
      >
        {items.map((item) => {
          const isActive = item.key === active;
          return (
            <Link
              key={item.key}
              href={item.href!}
              className={cn(
                "shrink-0 border-b-2 pb-1 font-mono text-[0.78rem] font-medium tracking-wide whitespace-nowrap transition-colors",
                isActive
                  ? "border-[var(--desk-live)] text-[var(--desk-live)]"
                  : "border-transparent text-[var(--desk-text-muted)] hover:text-[var(--desk-text)]",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
