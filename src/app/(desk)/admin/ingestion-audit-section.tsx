"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

import { IngestionRunsPanel } from "./ingestion-runs-panel";

/**
 * Admin ingestion audit — collapsed by default so migrations and fetch
 * controls stay reachable. Mounts the heavy list only when expanded.
 */
export function IngestionAuditSection() {
  const [open, setOpen] = useState(false);

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="ingestion-run-audit-panel"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-[var(--desk-overlay-soft)] sm:px-5"
      >
        <div className="min-w-0">
          <h2 className="font-mono text-sm tracking-wide text-foreground">
            Ingestion run audit
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Last multi-source orchestrator runs (cron + Admin). Expand to load
            the log — 20 rows per page; expand a row for per-source results.
          </p>
        </div>
        <ChevronDown
          className={cn(
            "mt-0.5 size-4 shrink-0 text-[var(--desk-text-muted)] transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          id="ingestion-run-audit-panel"
          className="border-t border-border/60 px-4 py-4 sm:px-5"
        >
          <IngestionRunsPanel />
        </div>
      ) : null}
    </section>
  );
}
