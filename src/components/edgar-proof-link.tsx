"use client";

import { ExternalLink } from "lucide-react";

import { originalSourceLabel } from "@/lib/catalysts/article-content";
import { cn } from "@/lib/utils";

/**
 * Admin-only “view original source” control (JTBD proof).
 * Primary reading stays in-app; this opens the vendor/filing URL externally.
 */
export function EdgarProofLink({
  url,
  provider = null,
  className,
  compact = false,
}: {
  url: string | null;
  /** raw_sources.provider — drives the CTA label. */
  provider?: string | null;
  className?: string;
  compact?: boolean;
}) {
  const label = originalSourceLabel(provider);
  const shortLabel =
    provider === "sec-edgar"
      ? "EDGAR"
      : provider === "nasdaq-halts"
        ? "Nasdaq"
        : "Source";

  if (!url) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 font-mono text-[0.68rem] text-[var(--desk-text-dim)]",
          className,
        )}
        title="No original source URL stored for this row"
      >
        <ExternalLink className="size-3 opacity-50" />
        {compact ? "—" : "No source link"}
      </span>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-2 py-1 font-mono text-[0.68rem] text-[var(--desk-accent-fg)] transition-colors hover:border-[var(--desk-accent)]/50 hover:bg-[var(--desk-accent)]/10",
        className,
      )}
      title={label}
    >
      <ExternalLink className="size-3 shrink-0" />
      {compact ? shortLabel : label}
    </a>
  );
}
