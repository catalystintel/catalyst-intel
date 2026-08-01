"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Eye, ListFilter, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { SkeletonCard } from "@/components/loading-skeleton";
import type { WatchlistCriteria } from "@/db/schema";
import type { FeedCatalyst } from "@/lib/catalysts/feed-catalyst";
import { titleLine } from "@/lib/catalysts/feed-display";
import { toUserFacingMessage } from "@/lib/errors/user-facing";
import { feedHref } from "@/lib/nav/feed-href";
import { cn } from "@/lib/utils";

interface SavedWatchlist {
  id: number;
  name: string;
  criteria: WatchlistCriteria;
  createdAt: string;
  updatedAt: string;
}

/** `category:earnings` → "Category: earnings" — mirrors the tape's tag chips. */
function tagLabel(tag: string): string {
  const [ns, ...rest] = tag.split(":");
  if (rest.length === 0) return tag;
  return `${ns.charAt(0).toUpperCase()}${ns.slice(1)}: ${rest.join(":")}`;
}

function criteriaChips(criteria: WatchlistCriteria): string[] {
  const chips: string[] = [];
  for (const symbol of criteria.symbols ?? []) chips.push(symbol);
  for (const category of criteria.categories ?? []) chips.push(category);
  for (const form of criteria.forms ?? []) chips.push(form);
  for (const tag of criteria.tags ?? []) chips.push(tagLabel(tag));
  for (const source of criteria.sources ?? []) chips.push(source);
  if (criteria.q) chips.push(`"${criteria.q}"`);
  return chips;
}

/**
 * "Smart" watchlists — saved feed-filter combos (symbols/categories/forms/
 * tags/sources), created from the Catalyst Feed filter panel's "Save as
 * watchlist". Unlike the flat symbol list above, each row here is an
 * arbitrary, re-appliable, previewable filter combination.
 */
export function SmartWatchlistsPanel() {
  const [watchlists, setWatchlists] = useState<SavedWatchlist[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [previews, setPreviews] = useState<
    Record<number, { total: number; catalysts: FeedCatalyst[] } | "loading">
  >({});
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/watchlists", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load watchlists.");
      setWatchlists(data.watchlists ?? []);
    } catch (err) {
      toast.error(toUserFacingMessage(err, "Could not load watchlists."));
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  async function togglePreview(id: number) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (previews[id] && previews[id] !== "loading") return;
    setPreviews((prev) => ({ ...prev, [id]: "loading" }));
    try {
      const res = await fetch(`/api/watchlists/${id}/preview`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preview failed.");
      setPreviews((prev) => ({
        ...prev,
        [id]: { total: data.total ?? 0, catalysts: data.catalysts ?? [] },
      }));
    } catch (err) {
      toast.error(toUserFacingMessage(err, "Preview failed."));
      setPreviews((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setExpandedId(null);
    }
  }

  async function deleteWatchlist(id: number, name: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/watchlists/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not delete.");
      setWatchlists((prev) => prev.filter((w) => w.id !== id));
      toast.success(`Deleted "${name}"`);
    } catch (err) {
      toast.error(toUserFacingMessage(err, "Could not delete watchlist."));
    } finally {
      setDeletingId(null);
    }
  }

  if (!loaded) {
    return <SkeletonCard lines={3} />;
  }

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)]">
      <div className="border-b border-[var(--desk-border)] px-4 py-4 sm:px-5">
        <h2 className="text-sm font-semibold text-[var(--desk-text)]">
          Smart watchlists
        </h2>
        <p className="mt-1 text-sm text-[var(--desk-text-muted)]">
          Saved filter combinations — symbols, event types, forms, tags,
          sources. Build one on the{" "}
          <Link href="/catalyst-feed" className="underline">
            Catalyst Feed
          </Link>
          : adjust the filter panel, then “Save as watchlist”. Next phase:
          reference these from alert rule conditions.
        </p>
      </div>

      {watchlists.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center sm:px-5">
          <span className="grid size-12 place-items-center rounded-xl border border-dashed border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] text-[var(--desk-text-dim)]">
            <ListFilter className="size-5" aria-hidden />
          </span>
          <p className="text-sm text-[var(--desk-text-muted)]">
            No smart watchlists yet — save one from the feed filter panel.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--desk-border)]">
          {watchlists.map((w) => {
            const chips = criteriaChips(w.criteria);
            const preview = previews[w.id];
            const isOpen = expandedId === w.id;
            return (
              <li key={w.id} className="px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--desk-text)]">
                      {w.name}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {chips.length === 0 ? (
                        <span className="text-xs text-[var(--desk-text-dim)]">
                          No filters
                        </span>
                      ) : (
                        chips.map((chip, i) => (
                          <span
                            key={`${chip}-${i}`}
                            className="rounded-full border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-2 py-0.5 font-mono text-[0.65rem] text-[var(--desk-text-secondary)]"
                          >
                            {chip}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={feedHref({ criteria: w.criteria })}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-2.5 font-mono text-[0.7rem] text-[var(--desk-text-secondary)] transition-colors hover:bg-[var(--desk-overlay-strong)] hover:text-[var(--desk-text)]"
                    >
                      <ListFilter className="size-3" />
                      Apply to feed
                    </Link>
                    <button
                      type="button"
                      onClick={() => void togglePreview(w.id)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-2.5 font-mono text-[0.7rem] text-[var(--desk-text-secondary)] transition-colors hover:bg-[var(--desk-overlay-strong)] hover:text-[var(--desk-text)]"
                      aria-expanded={isOpen}
                    >
                      <Eye className="size-3" />
                      Preview
                      <ChevronDown
                        className={cn(
                          "size-3 transition-transform",
                          isOpen && "rotate-180",
                        )}
                      />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${w.name}`}
                      disabled={deletingId === w.id}
                      onClick={() => void deleteWatchlist(w.id, w.name)}
                      className="rounded-md p-2 text-[var(--desk-text-muted)] transition-colors hover:bg-[var(--desk-overlay-strong)] hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>

                {isOpen ? (
                  <div className="mt-3 rounded-lg border border-[var(--desk-border)] bg-[var(--desk-header)]/60 px-3 py-3">
                    {preview === "loading" || !preview ? (
                      <p className="font-mono text-[0.7rem] text-[var(--desk-text-dim)]">
                        Loading preview…
                      </p>
                    ) : preview.catalysts.length === 0 ? (
                      <p className="text-sm text-[var(--desk-text-muted)]">
                        No matches right now — {preview.total} total in the
                        current retention window.
                      </p>
                    ) : (
                      <>
                        <p className="mb-2 font-mono text-[0.68rem] text-[var(--desk-text-dim)]">
                          {preview.total} match
                          {preview.total === 1 ? "" : "es"} · showing{" "}
                          {preview.catalysts.length}
                        </p>
                        <ul className="flex flex-col gap-1.5">
                          {preview.catalysts.map((c) => (
                            <li
                              key={c.id}
                              className="truncate font-mono text-[0.72rem] text-[var(--desk-text-secondary)]"
                            >
                              <span className="font-semibold text-[var(--desk-text)]">
                                {c.symbol ?? "—"}
                              </span>{" "}
                              · {titleLine(c)}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
