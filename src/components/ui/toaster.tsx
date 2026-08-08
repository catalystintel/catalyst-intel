"use client";

import { Toaster as SonnerToaster } from "sonner";

/**
 * Desk-themed toast host. Mounted once in `AppShell` so any client
 * component can call `toast(...)` from `sonner` without wiring its own
 * inline error/message state (see live-catalyst-feed's `pollError`,
 * watchlists/watchlist-hub and alert-rules-panel for the pattern this
 * replaces).
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      theme="system"
      className="font-sans"
      toastOptions={{
        classNames: {
          toast:
            "!rounded-lg !border !border-[var(--desk-border-strong)] !bg-popover !text-[var(--desk-text)] !shadow-[0_12px_32px_var(--desk-panel-shadow)]",
          title: "!text-[var(--desk-text)] !font-medium",
          description: "!text-[var(--desk-text-muted)]",
          actionButton:
            "!bg-[var(--desk-live)] !text-[var(--desk-accent-fg)] !font-semibold",
          cancelButton:
            "!bg-transparent !text-[var(--desk-text-muted)] !border !border-[var(--desk-border-strong)]",
          error: "!border-[var(--destructive)]/45",
          success: "!border-[var(--desk-live)]/45",
        },
      }}
    />
  );
}
