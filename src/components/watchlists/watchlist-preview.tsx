"use client";

import { Loader2 } from "lucide-react";

import type { FeedCatalyst } from "@/lib/catalysts/feed-catalyst";
import { titleLine } from "@/lib/catalysts/feed-display";
import type { WatchlistCriteria } from "@/db/schema";

export interface WatchlistPreview {
  total: number;
  catalysts: FeedCatalyst[];
}

export type PreviewState = WatchlistPreview | "loading" | null;

/** Ad-hoc preview for an unsaved draft (builder). */
export async function fetchDraftPreview(
  criteria: WatchlistCriteria,
): Promise<WatchlistPreview> {
  const res = await fetch("/api/watchlists/preview", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ criteria }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Preview failed.");
  return { total: data.total ?? 0, catalysts: data.catalysts ?? [] };
}

/** Preview for a saved watchlist. */
export async function fetchSavedPreview(id: number): Promise<WatchlistPreview> {
  const res = await fetch(`/api/watchlists/${id}/preview`, {
    credentials: "same-origin",
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Preview failed.");
  return { total: data.total ?? 0, catalysts: data.catalysts ?? [] };
}

/** Compact "what would this match" list — sample rows, newest first. */
export function PreviewRows({
  preview,
  emptyHint = "Add a filter to see live matches.",
  limit = 3,
}: {
  preview: PreviewState;
  emptyHint?: string;
  limit?: number;
}) {
  if (preview === "loading") {
    return (
      <p className="flex items-center gap-1.5 font-mono text-[0.7rem] text-[var(--desk-text-dim)]">
        <Loader2 className="size-3 animate-spin" />
        Checking matches…
      </p>
    );
  }
  if (!preview) {
    return (
      <p className="font-mono text-[0.7rem] text-[var(--desk-text-dim)]">
        {emptyHint}
      </p>
    );
  }
  if (preview.catalysts.length === 0) {
    return (
      <p className="text-xs text-[var(--desk-text-muted)]">
        No matches in the current retention window.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-mono text-[0.68rem] text-[var(--desk-live)]">
        {preview.total.toLocaleString()} matching event
        {preview.total === 1 ? "" : "s"}
      </p>
      <ul className="flex flex-col gap-1">
        {preview.catalysts.slice(0, limit).map((c) => (
          <li
            key={c.id}
            className="truncate font-mono text-[0.7rem] text-[var(--desk-text-secondary)]"
          >
            <span className="font-semibold text-[var(--desk-text)]">
              {c.symbol ?? "—"}
            </span>{" "}
            · {titleLine(c)}
          </li>
        ))}
      </ul>
    </div>
  );
}
