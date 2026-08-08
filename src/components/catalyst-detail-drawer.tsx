"use client";

import { useEffect } from "react";
import Link from "next/link";
import { BookOpen, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CategoryBadge } from "@/components/category-badge";
import type { FeedCatalyst } from "@/lib/catalysts/feed-catalyst";
import { formatEventTime, formatRelativeAge } from "@/lib/format/relative-time";
import { CATEGORY_LABELS } from "@/lib/jobs/parse-8k-items";
import { cn } from "@/lib/utils";

export function CatalystDetailDrawer({
  catalyst,
  onClose,
  onDismiss,
}: {
  catalyst: FeedCatalyst | null;
  onClose: () => void;
  onDismiss?: () => void;
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
          "absolute inset-0 bg-[var(--desk-scrim)] transition-opacity duration-200",
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
          "drawer-panel absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-[var(--desk-border)] bg-[var(--desk-panel)] shadow-[-12px_0_40px_rgba(0,0,0,0.55)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {catalyst ? (
          <>
            <div className="flex items-start justify-between gap-3 border-b border-[var(--desk-border)] bg-[var(--desk-header)] px-5 py-4">
              <div className="min-w-0">
                <p className="font-mono text-[0.65rem] tracking-[0.18em] text-[var(--desk-live)] uppercase">
                  {catalyst.headline ?? "Catalyst"}
                </p>
                <h2
                  id={`catalyst-drawer-${catalyst.id}`}
                  className="mt-1 truncate font-mono text-2xl font-semibold tracking-tight text-[var(--desk-text)]"
                >
                  {catalyst.symbol ?? "—"}
                </h2>
                {catalyst.companyName ? (
                  <p className="mt-0.5 truncate text-sm text-[var(--desk-text-muted)]">
                    {catalyst.companyName}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="btn-press shrink-0 text-[var(--desk-text-muted)] hover:text-[var(--desk-text)]"
                onClick={onClose}
              >
                <XIcon />
                <span className="sr-only">Close</span>
              </Button>
            </div>

            <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
              <div className="flex flex-wrap items-center gap-2">
                {catalyst.eventCategory ? (
                  <CategoryBadge category={catalyst.eventCategory} />
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/catalyst-feed/catalyst/${catalyst.id}`}
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 rounded-sm bg-[var(--desk-live)] px-3 py-1.5 font-mono text-xs font-semibold tracking-wide text-[var(--desk-accent-fg)] uppercase hover:brightness-110"
                >
                  <BookOpen className="size-3.5" />
                  Details
                </Link>
                <button
                  type="button"
                  onClick={() => onDismiss?.()}
                  className="inline-flex items-center gap-1.5 rounded-sm border border-[var(--desk-border-strong)] px-3 py-1.5 font-mono text-xs tracking-wide text-[var(--desk-text-muted)] uppercase hover:bg-[var(--desk-overlay-strong)] hover:text-[var(--desk-text)]"
                >
                  Dismiss
                </button>
              </div>

              <dl className="grid grid-cols-2 gap-4 font-mono text-xs">
                <div>
                  <dt className="tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
                    Category
                  </dt>
                  <dd className="mt-1 text-sm text-[var(--desk-text)]">
                    {catalyst.eventCategory
                      ? CATEGORY_LABELS[catalyst.eventCategory]
                      : "—"}
                    {catalyst.subcategory
                      ? ` · ${catalyst.subcategory.replace(/_/g, " ")}`
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt className="tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
                    Form
                  </dt>
                  <dd className="mt-1 text-sm text-[var(--desk-text)]">
                    {catalyst.type}
                  </dd>
                </div>
                <div>
                  <dt className="tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
                    Age
                  </dt>
                  <dd className="mt-1 text-sm text-[var(--desk-text)] tabular-nums">
                    {formatRelativeAge(catalyst.timestamp)}
                  </dd>
                </div>
                {catalyst.confidence != null ? (
                  <div>
                    <dt className="tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
                      Confidence
                    </dt>
                    <dd className="mt-1 text-sm text-[var(--desk-text)] tabular-nums">
                      {catalyst.confidence}
                    </dd>
                  </div>
                ) : null}
                <div className="col-span-2">
                  <dt className="tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
                    Event time
                  </dt>
                  <dd className="mt-1 text-sm text-[var(--desk-text)] tabular-nums">
                    {formatEventTime(catalyst.timestamp)}
                  </dd>
                </div>
              </dl>

              <div>
                <p className="font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
                  Summary
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--desk-text-secondary)]">
                  {catalyst.summary?.trim() ||
                    catalyst.headline?.trim() ||
                    catalyst.title}
                </p>
              </div>

              {catalyst.items.length > 0 ? (
                <div>
                  <p className="font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
                    Filing items
                  </p>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {catalyst.items.map((item) => (
                      <li
                        key={item.code}
                        className="flex items-baseline gap-2 text-sm"
                      >
                        <span className="font-mono text-xs text-[var(--desk-text-secondary)] tabular-nums">
                          {item.code}
                        </span>
                        <span className="text-[var(--desk-text-secondary)]">
                          {item.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="rounded-md border border-dashed border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-3 py-3">
                <p className="font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
                  Historical reaction
                </p>
                {catalyst.historicalImpact &&
                typeof catalyst.historicalImpact === "object" &&
                catalyst.historicalImpact !== null &&
                "pctChange" in catalyst.historicalImpact ? (
                  <p className="mt-1.5 font-mono text-sm text-[var(--desk-text-secondary)] tabular-nums">
                    Session move:{" "}
                    {Number(
                      (catalyst.historicalImpact as { pctChange: number })
                        .pctChange,
                    ).toFixed(2)}
                    %
                    {"date" in catalyst.historicalImpact
                      ? ` · ${(catalyst.historicalImpact as { date?: string }).date}`
                      : ""}
                  </p>
                ) : (
                  <p className="mt-1.5 text-sm text-[var(--desk-text-muted)]">
                    No session-move context for this event yet.
                  </p>
                )}
              </div>
            </div>
          </>
        ) : null}
      </aside>
    </div>
  );
}
