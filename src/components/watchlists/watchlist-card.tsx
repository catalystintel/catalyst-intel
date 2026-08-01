"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BellRing,
  ChevronDown,
  ListFilter,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";

import {
  fetchSavedPreview,
  PreviewRows,
  type PreviewState,
} from "@/components/watchlists/watchlist-preview";
import type { WatchlistCriteria } from "@/db/schema";
import { criteriaChips } from "@/lib/watchlist/criteria-display";
import { feedHref } from "@/lib/nav/feed-href";
import { cn } from "@/lib/utils";

export interface SavedWatchlist {
  id: number;
  name: string;
  criteria: WatchlistCriteria;
  createdAt: string;
  updatedAt: string;
}

const CHIP_TONE: Record<string, string> = {
  symbol:
    "border-[var(--desk-live)]/40 bg-[var(--desk-live)]/10 text-[var(--desk-live)]",
  category:
    "border-[var(--desk-border-strong)] text-[var(--desk-text-secondary)]",
  form: "border-[var(--desk-border-strong)] text-[var(--desk-text-secondary)]",
  tag: "border-[var(--desk-border)] text-[var(--desk-text-muted)]",
  source: "border-[var(--desk-border)] text-[var(--desk-text-muted)]",
  text: "border-[var(--desk-border)] text-[var(--desk-text-muted)]",
};

const VISIBLE_CHIPS = 5;

/**
 * One watchlist as a scannable card: what it matches, how many events it is
 * catching, whether it feeds quiet mode, and the actions that matter (open on
 * the tape, preview, edit, delete).
 */
export function WatchlistCard({
  watchlist,
  isQuietSignal,
  onToggleQuiet,
  onEdit,
  onDelete,
  busy = false,
}: {
  watchlist: SavedWatchlist;
  isQuietSignal: boolean;
  onToggleQuiet: () => void;
  onEdit: () => void;
  onDelete: () => void;
  busy?: boolean;
}) {
  const [preview, setPreview] = useState<PreviewState>("loading");
  const [expanded, setExpanded] = useState(false);
  const chips = criteriaChips(watchlist.criteria);
  const overflow = Math.max(0, chips.length - VISIBLE_CHIPS);

  // Match count is the headline stat — load it as the card mounts.
  useEffect(() => {
    let cancelled = false;
    const id = window.setTimeout(() => {
      void fetchSavedPreview(watchlist.id)
        .then((p) => {
          if (!cancelled) setPreview(p);
        })
        .catch(() => {
          if (!cancelled) setPreview(null);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [watchlist.id, watchlist.updatedAt]);

  const matchCount = preview && preview !== "loading" ? preview.total : null;

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)] p-4 transition-colors hover:border-[var(--desk-border-strong)]">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-[var(--desk-text)]">
            {watchlist.name}
          </h3>
          <p className="mt-0.5 font-mono text-[0.68rem] text-[var(--desk-text-muted)] tabular-nums">
            {preview === "loading" ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" />
                counting…
              </span>
            ) : matchCount === null ? (
              "match count unavailable"
            ) : (
              `${matchCount.toLocaleString()} matching event${matchCount === 1 ? "" : "s"}`
            )}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isQuietSignal}
          aria-label={`Use ${watchlist.name} as a quiet-mode signal`}
          disabled={busy}
          onClick={onToggleQuiet}
          title={
            isQuietSignal
              ? "Counts as signal in Quiet mode"
              : "Add to Quiet mode signals"
          }
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 font-mono text-[0.65rem] transition-colors",
            isQuietSignal
              ? "border-[var(--desk-live)]/45 bg-[var(--desk-live)]/10 text-[var(--desk-live)]"
              : "border-[var(--desk-border-strong)] text-[var(--desk-text-dim)] hover:text-[var(--desk-text)]",
          )}
        >
          <BellRing className="size-3" />
          {isQuietSignal ? "Quiet signal" : "Quiet off"}
        </button>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {chips.length === 0 ? (
          <span className="text-xs text-[var(--desk-text-dim)]">
            No filters
          </span>
        ) : (
          <>
            {chips.slice(0, VISIBLE_CHIPS).map((chip) => (
              <span
                key={chip.key}
                className={cn(
                  "rounded-full border px-2 py-0.5 font-mono text-[0.65rem]",
                  CHIP_TONE[chip.kind],
                )}
              >
                {chip.label}
              </span>
            ))}
            {overflow > 0 ? (
              <span className="rounded-full border border-[var(--desk-border)] px-2 py-0.5 font-mono text-[0.65rem] text-[var(--desk-text-dim)]">
                +{overflow} more
              </span>
            ) : null}
          </>
        )}
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t border-[var(--desk-border)] pt-3">
        <Link
          href={feedHref({ criteria: watchlist.criteria })}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--desk-live)]/45 bg-[var(--desk-live)]/10 px-2.5 font-mono text-[0.7rem] font-medium text-[var(--desk-live)] transition-colors hover:bg-[var(--desk-live)]/20"
        >
          <ListFilter className="size-3" />
          Open on tape
        </Link>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--desk-border-strong)] px-2.5 font-mono text-[0.7rem] text-[var(--desk-text-secondary)] transition-colors hover:bg-[var(--desk-overlay-strong)] hover:text-[var(--desk-text)]"
        >
          Preview
          <ChevronDown
            className={cn(
              "size-3 transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-label={`Edit ${watchlist.name}`}
            onClick={onEdit}
            className="rounded-md p-1.5 text-[var(--desk-text-muted)] transition-colors hover:bg-[var(--desk-overlay-strong)] hover:text-[var(--desk-text)]"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label={`Delete ${watchlist.name}`}
            disabled={busy}
            onClick={onDelete}
            className="rounded-md p-1.5 text-[var(--desk-text-muted)] transition-colors hover:bg-[var(--desk-overlay-strong)] hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </footer>

      {expanded ? (
        <div className="border-t border-[var(--desk-border)] pt-3">
          <div className="rounded-lg border border-[var(--desk-border)] bg-[var(--desk-header)]/60 px-3 py-2.5">
            <PreviewRows preview={preview} limit={5} />
          </div>
        </div>
      ) : null}
    </article>
  );
}
