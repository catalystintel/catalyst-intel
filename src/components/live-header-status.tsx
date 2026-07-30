"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type Presence = "active" | "blurred" | "hidden";

function readPresence(): Presence {
  if (typeof document === "undefined") return "active";
  if (document.visibilityState === "hidden") return "hidden";
  if (typeof document.hasFocus === "function" && !document.hasFocus()) {
    return "blurred";
  }
  return "active";
}

/**
 * Top-bar LIVE pill + status copy for the trading-desk chrome.
 */
export function LiveHeaderStatus() {
  const [presence, setPresence] = useState<Presence>("active");

  useEffect(() => {
    const sync = () => setPresence(readPresence());
    sync();
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("blur", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("blur", sync);
    };
  }, []);

  const live = presence === "active";
  const label =
    presence === "hidden" ? "Paused" : presence === "blurred" ? "Slow" : "LIVE";
  const copy =
    presence === "hidden"
      ? "Feed paused while this tab is hidden."
      : presence === "blurred"
        ? "Polling slowly while the window is blurred."
        : "Monitoring global news and events.";

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.68rem] font-bold tracking-[0.08em]",
          live
            ? "border-[color-mix(in_srgb,var(--desk-live-status)_35%,transparent)] bg-[color-mix(in_srgb,var(--desk-live-status)_12%,transparent)] text-[var(--desk-live-status)]"
            : "border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] text-[var(--desk-text-muted)]",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "size-1.5 rounded-full",
            live
              ? "live-pulse bg-[var(--desk-live-status)]"
              : "bg-[var(--desk-text-dim)]",
          )}
        />
        {label}
      </span>
      <span className="hidden truncate text-[0.86rem] text-[var(--desk-text-muted)] md:inline">
        {copy}
      </span>
    </div>
  );
}
