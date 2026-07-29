"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { CategoryBadge } from "@/components/category-badge";
import { SkeletonCard } from "@/components/loading-skeleton";
import type { NewsHeadline } from "@/lib/catalysts/news-feed-query";
import { newsSourceLabel } from "@/lib/catalysts/news-source-label";
import {
  FEED_TIME_WINDOWS,
  type FeedTimeWindow,
} from "@/lib/catalysts/feed-time-window";
import { formatClockTime, formatRelativeAge } from "@/lib/format/relative-time";
import {
  CATEGORY_LABELS,
  type EventCategoryKey,
} from "@/lib/catalysts/taxonomy";
import { cn } from "@/lib/utils";

const NEWS_CATEGORIES: EventCategoryKey[] = [
  "earnings",
  "regulatory",
  "clinical",
  "deals",
  "capital",
  "analyst",
  "macro",
  "trading_halt",
];

const POLL_INTERVAL_MS = 20_000;

interface SentimentCueProps {
  sentiment: NewsHeadline["sentiment"];
}

function SentimentCue({ sentiment }: SentimentCueProps) {
  if (!sentiment || sentiment === "neutral") return null;
  return (
    <span
      className={cn(
        "font-mono text-[0.65rem] font-semibold tracking-wide uppercase",
        sentiment === "bullish"
          ? "text-[var(--desk-positive)]"
          : "text-[var(--desk-negative)]",
      )}
    >
      {sentiment === "bullish" ? "▲" : "▼"}
    </span>
  );
}

interface Props {
  initialHeadlines: NewsHeadline[];
  initialTotal: number | null;
}

export function NewsFeed({ initialHeadlines, initialTotal }: Props) {
  const [headlines, setHeadlines] = useState<NewsHeadline[]>(initialHeadlines);
  const [total, setTotal] = useState<number | null>(initialTotal);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [timeWindow, setTimeWindow] = useState<FeedTimeWindow>("24h");
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCategories, setActiveCategories] = useState<EventCategoryKey[]>(
    [],
  );
  const [now, setNow] = useState(() => Date.now());

  const abortRef = useRef<AbortController | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const buildParams = useCallback(
    (cursor?: string | null) => {
      const p = new URLSearchParams();
      p.set("window", timeWindow);
      if (watchlistOnly) p.set("watchlist", "1");
      if (query) p.set("q", query);
      if (activeCategories.length > 0)
        p.set("categories", activeCategories.join(","));
      if (cursor) p.set("cursor", cursor);
      return p;
    },
    [timeWindow, watchlistOnly, query, activeCategories],
  );

  const fetchPage = useCallback(
    async (cursor?: string | null) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(`/api/news?${buildParams(cursor).toString()}`, {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load headlines.");
        return data as {
          headlines: NewsHeadline[];
          total: number | null;
          nextCursor: string | null;
        };
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError")
          return null;
        throw err;
      }
    },
    [buildParams],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setNextCursor(null);
    try {
      const data = await fetchPage(null);
      if (!data) return;
      setHeadlines(data.headlines);
      setTotal(data.total);
      setNextCursor(data.nextCursor);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not load headlines.",
      );
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  const softPoll = useCallback(async () => {
    try {
      const data = await fetchPage(null);
      if (!data) return;
      setHeadlines(data.headlines);
      setTotal(data.total);
      setNextCursor(data.nextCursor);
    } catch {
      // soft poll: swallow errors silently
    }
  }, [fetchPage]);

  // Defer initial load to avoid set-state-in-effect lint
  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  // Soft-poll every 20s
  useEffect(() => {
    const schedule = () => {
      pollRef.current = window.setTimeout(async () => {
        await softPoll();
        schedule();
      }, POLL_INTERVAL_MS);
    };
    schedule();
    return () => {
      if (pollRef.current !== null) window.clearTimeout(pollRef.current);
    };
  }, [softPoll]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchPage(nextCursor);
      if (!data) return;
      setHeadlines((prev) => [...prev, ...data.headlines]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not load more headlines.",
      );
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleCategory = (cat: EventCategoryKey) => {
    setActiveCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5">
      <div className="border-b border-[var(--desk-border)] pb-4">
        <p className="font-mono text-[0.65rem] tracking-[0.2em] text-[var(--desk-live)] uppercase">
          Headline stream
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-[var(--desk-text)] sm:text-2xl">
          News Feed
        </h1>
        <p className="mt-1 max-w-xl text-sm text-[var(--desk-text-muted)]">
          Wire and company news headlines. Separate from the Catalyst Feed
          triage blotter — no SEC filings, halts, or FDA calendars here.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {FEED_TIME_WINDOWS.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => setTimeWindow(w.id)}
              className={cn(
                "inline-flex h-8 items-center rounded-md border px-3 font-mono text-[0.72rem] tracking-wide transition-colors",
                timeWindow === w.id
                  ? "border-[var(--desk-text-dim)] bg-[var(--desk-overlay-strong)] text-[var(--desk-text)]"
                  : "border-[var(--desk-border)] text-[var(--desk-text-muted)] hover:border-[var(--desk-border-strong)] hover:text-[var(--desk-text)]",
              )}
            >
              {w.label}
            </button>
          ))}

          <span className="mx-1 h-4 w-px bg-[var(--desk-border)]" aria-hidden />

          <button
            type="button"
            onClick={() => setWatchlistOnly((v) => !v)}
            className={cn(
              "inline-flex h-8 items-center rounded-md border px-3 font-mono text-[0.72rem] tracking-wide transition-colors",
              watchlistOnly
                ? "border-[var(--desk-live)] bg-[rgba(240,193,75,0.12)] text-[var(--desk-live)]"
                : "border-[var(--desk-border)] text-[var(--desk-text-muted)] hover:border-[var(--desk-border-strong)] hover:text-[var(--desk-text)]",
            )}
          >
            Watchlist
          </button>
        </div>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value.toUpperCase())}
          placeholder="Symbol or headline…"
          aria-label="Search headlines"
          className="h-9 w-full max-w-sm rounded-md border border-[var(--desk-border)] bg-transparent px-3 text-sm text-[var(--desk-text)] placeholder:text-[var(--desk-text-dim)] focus:border-[var(--desk-border-strong)] focus:outline-none"
        />

        <div className="flex flex-wrap gap-1.5">
          {NEWS_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => toggleCategory(cat)}
              className={cn(
                "inline-flex h-7 items-center rounded-sm border px-2 font-mono text-[0.6rem] tracking-[0.08em] uppercase transition-colors",
                activeCategories.includes(cat)
                  ? "border-[var(--desk-border-strong)] bg-[var(--desk-overlay-strong)] text-[var(--desk-text)]"
                  : "border-[var(--desk-border)] text-[var(--desk-text-muted)] hover:border-[var(--desk-border-strong)] hover:text-[var(--desk-text)]",
              )}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-[var(--desk-border)] bg-[var(--desk-panel)]">
        <div className="hidden grid-cols-[4.5rem_minmax(0,1fr)_8rem_2.5rem_7rem_5rem] gap-3 border-b border-[var(--desk-border)] px-4 py-2 font-mono text-[0.6rem] tracking-[0.1em] text-[var(--desk-text-dim)] uppercase sm:grid">
          <span>Symbol</span>
          <span>Headline</span>
          <span>Source</span>
          <span>Lean</span>
          <span>Category</span>
          <span className="text-right">Time</span>
        </div>

        {loading ? (
          <div className="space-y-3 p-4">
            <SkeletonCard lines={1} />
            <SkeletonCard lines={1} />
            <SkeletonCard lines={1} />
            <SkeletonCard lines={1} />
            <SkeletonCard lines={1} />
          </div>
        ) : headlines.length === 0 ? (
          <EmptyState watchlistOnly={watchlistOnly} />
        ) : (
          <ul className="divide-y divide-[var(--desk-border)]">
            {headlines.map((h) => (
              <HeadlineRow key={h.id} headline={h} now={now} />
            ))}
          </ul>
        )}

        {!loading && nextCursor && (
          <div className="border-t border-[var(--desk-border)] px-4 py-3 text-center">
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => void loadMore()}
              className="font-mono text-[0.72rem] text-[var(--desk-text-muted)] hover:text-[var(--desk-text)] disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        )}

        {!loading && total !== null && (
          <div className="border-t border-[var(--desk-border)] px-4 py-2 font-mono text-[0.65rem] text-[var(--desk-text-dim)]">
            {total.toLocaleString()} headline{total === 1 ? "" : "s"} in window
          </div>
        )}
      </div>
    </div>
  );
}

function HeadlineRow({
  headline: h,
  now,
}: {
  headline: NewsHeadline;
  now: number;
}) {
  return (
    <li>
      <Link
        href={`/catalyst-feed/catalyst/${h.id}`}
        className="grid grid-cols-[4rem_minmax(0,1fr)_3rem] items-start gap-2 px-3 py-2.5 transition-colors hover:bg-[var(--desk-overlay-soft)] sm:grid-cols-[4.5rem_minmax(0,1fr)_8rem_2.5rem_7rem_5rem] sm:gap-3 sm:px-4"
      >
        <span className="font-mono text-[0.8rem] font-semibold text-[var(--desk-text)]">
          {h.symbol ?? <span className="text-[var(--desk-text-dim)]">—</span>}
        </span>

        <span className="min-w-0">
          <span className="line-clamp-2 text-[0.82rem] leading-snug text-[var(--desk-text)]">
            {h.title}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 sm:hidden">
            {h.eventCategory && <CategoryBadge category={h.eventCategory} />}
            <span className="font-mono text-[0.65rem] text-[var(--desk-text-dim)]">
              {newsSourceLabel(h)}
            </span>
          </span>
        </span>

        <span className="hidden truncate font-mono text-[0.68rem] text-[var(--desk-text-muted)] sm:block">
          {newsSourceLabel(h)}
        </span>

        <span className="hidden sm:flex sm:items-start sm:pt-0.5">
          <SentimentCue sentiment={h.sentiment} />
        </span>

        <span className="hidden sm:block sm:pt-0.5">
          {h.eventCategory ? (
            <CategoryBadge category={h.eventCategory} />
          ) : null}
        </span>

        <span
          className="pt-0.5 text-right font-mono text-[0.72rem] text-[var(--desk-text-muted)] tabular-nums"
          title={formatClockTime(h.timestamp)}
        >
          {formatRelativeAge(h.timestamp, now)}
        </span>
      </Link>
    </li>
  );
}

function EmptyState({ watchlistOnly }: { watchlistOnly: boolean }) {
  if (watchlistOnly) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
        <p className="text-sm font-medium text-[var(--desk-text)]">
          No headlines for your watchlist
        </p>
        <p className="max-w-sm text-sm text-[var(--desk-text-muted)]">
          Add symbols on Watchlists, or turn off the Watchlist filter to see all
          headlines.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      <p className="text-sm font-medium text-[var(--desk-text)]">
        No headlines in this window
      </p>
      <p className="max-w-sm text-sm text-[var(--desk-text-muted)]">
        Try widening the time window or clearing your category filters.
      </p>
    </div>
  );
}
