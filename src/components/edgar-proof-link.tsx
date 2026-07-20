"use client";

import { ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Always-visible one-click EDGAR proof link (JTBD 3).
 * Renders a muted stub when no URL is stored so the control never disappears.
 */
export function EdgarProofLink({
  url,
  className,
  compact = false,
}: {
  url: string | null;
  className?: string;
  compact?: boolean;
}) {
  if (!url) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 font-mono text-[0.68rem] text-[var(--desk-text-dim)]",
          className,
        )}
        title="No EDGAR accession URL stored for this row"
      >
        <ExternalLink className="size-3 opacity-50" />
        {compact ? "—" : "No EDGAR link"}
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
        "inline-flex items-center gap-1.5 rounded-md border border-[var(--desk-border-strong)] bg-white/[0.03] px-2 py-1 font-mono text-[0.68rem] text-[var(--desk-accent-fg)] transition-colors hover:border-[var(--desk-accent)]/50 hover:bg-[var(--desk-accent)]/10",
        className,
      )}
      title="Open EDGAR filing (proof)"
    >
      <ExternalLink className="size-3 shrink-0" />
      {compact ? "EDGAR" : "Open EDGAR proof"}
    </a>
  );
}
