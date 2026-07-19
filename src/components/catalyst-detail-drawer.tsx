"use client";

import { useEffect } from "react";
import { ExternalLink, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatRelativeAge } from "@/lib/format/relative-time";
import { cn } from "@/lib/utils";

import type { FeedCatalyst } from "./live-catalyst-feed";

export function CatalystDetailDrawer({
  catalyst,
  onClose,
}: {
  catalyst: FeedCatalyst | null;
  onClose: () => void;
}) {
  const open = catalyst !== null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close catalyst detail"
        className={cn(
          "absolute inset-0 bg-black/55 transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={
          catalyst ? `catalyst-drawer-${catalyst.id}` : undefined
        }
        className={cn(
          "drawer-panel absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-border/80 bg-[oklch(0.17_0.018_255)] shadow-[-12px_0_40px_rgba(0,0,0,0.45)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {catalyst ? (
          <>
            <div className="flex items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
              <div className="min-w-0">
                <p className="font-mono text-[0.65rem] tracking-[0.18em] text-amber-400/90 uppercase">
                  Catalyst
                </p>
                <h2
                  id={`catalyst-drawer-${catalyst.id}`}
                  className="mt-1 truncate font-mono text-2xl font-semibold tracking-tight text-steel-foreground"
                >
                  {catalyst.ticker ?? "—"}
                </h2>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="btn-press shrink-0"
                onClick={onClose}
              >
                <XIcon />
                <span className="sr-only">Close</span>
              </Button>
            </div>

            <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
              <dl className="grid grid-cols-2 gap-4 font-mono text-xs">
                <div>
                  <dt className="tracking-[0.14em] text-muted-foreground uppercase">
                    Type
                  </dt>
                  <dd className="mt-1 text-sm text-foreground">
                    {catalyst.type}
                  </dd>
                </div>
                <div>
                  <dt className="tracking-[0.14em] text-muted-foreground uppercase">
                    Age
                  </dt>
                  <dd className="mt-1 text-sm text-foreground tabular-nums">
                    {formatRelativeAge(catalyst.timestamp)}
                  </dd>
                </div>
                <div>
                  <dt className="tracking-[0.14em] text-muted-foreground uppercase">
                    Impact
                  </dt>
                  <dd className="mt-1 text-sm text-muted-foreground">
                    {catalyst.impactScore != null
                      ? String(catalyst.impactScore)
                      : "Not scored yet"}
                  </dd>
                </div>
                <div>
                  <dt className="tracking-[0.14em] text-muted-foreground uppercase">
                    Filed
                  </dt>
                  <dd className="mt-1 text-sm text-foreground tabular-nums">
                    {new Date(catalyst.timestamp).toLocaleString()}
                  </dd>
                </div>
              </dl>

              <div>
                <p className="font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">
                  Why it matters
                </p>
                <p className="mt-2 text-sm leading-relaxed text-foreground/95">
                  {catalyst.summary?.trim() || catalyst.title}
                </p>
              </div>

              {catalyst.sourceUrl ? (
                <a
                  href={catalyst.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-press inline-flex w-fit items-center gap-2 rounded-md border border-steel/50 bg-steel/15 px-3 py-2 font-mono text-xs text-steel-foreground transition-colors hover:border-amber-400/50 hover:bg-amber-400/10 hover:text-amber-200"
                >
                  Open SEC filing
                  <ExternalLink className="size-3.5" />
                </a>
              ) : (
                <p className="font-mono text-xs text-muted-foreground">
                  No filing deep-link stored for this row.
                </p>
              )}
            </div>
          </>
        ) : null}
      </aside>
    </div>
  );
}
