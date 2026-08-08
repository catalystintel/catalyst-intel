"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toUserFacingMessage } from "@/lib/errors/user-facing";

type GuestHit = {
  id: number;
  symbol: string | null;
  title: string;
  category: string | null;
  timestamp: string;
  summary: string | null;
};

/**
 * Prelogin teaser: 2–3 free ticker lookups against the Live catalyst DB,
 * then nudge to Google sign-in for the full desk.
 */
export function LandingGuestSearch({
  className,
  signInHref = "/login",
}: {
  className?: string;
  /** Same target as other marketing CTAs (bypass chooser vs Google OAuth). */
  signInHref?: string;
}) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<GuestHit[] | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limitHit, setLimitHit] = useState(false);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const symbol = q.trim();
    if (!symbol) return;

    setLoading(true);
    setError(null);
    setHits(null);
    try {
      const res = await fetch(
        `/api/guest/search?q=${encodeURIComponent(symbol)}`,
        { credentials: "same-origin" },
      );
      const data = (await res.json()) as {
        results?: GuestHit[];
        remaining?: number;
        error?: string;
        message?: string;
      };
      if (res.status === 429 && data.error === "free_limit") {
        setLimitHit(true);
        setRemaining(0);
        setError(data.message ?? "Free search limit reached.");
        return;
      }
      if (!res.ok) {
        throw new Error(data.error ?? data.message ?? "Search failed.");
      }
      setHits(data.results ?? []);
      setRemaining(typeof data.remaining === "number" ? data.remaining : null);
      if ((data.remaining ?? 1) <= 0) setLimitHit(true);
    } catch (err) {
      setError(toUserFacingMessage(err, "Search failed."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn("landing-glass-card rounded-xl p-4 sm:p-5", className)}>
      <p className="font-mono text-[0.65rem] font-semibold tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
        Instant ticker search
      </p>
      <p className="mt-1 text-sm text-[var(--desk-text-muted)]">
        Peek at recent catalysts for a stock — {limitHit ? "0" : "up to 3"} free
        lookups, then sign in for the full Live tape.
      </p>
      <form
        onSubmit={onSearch}
        className="mt-3 flex flex-wrap items-center gap-2"
      >
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value.toUpperCase())}
          placeholder="e.g. NVDA"
          aria-label="Search ticker"
          maxLength={12}
          disabled={limitHit || loading}
          className="h-9 w-36 border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] font-mono text-xs uppercase"
        />
        <Button
          type="submit"
          disabled={limitHit || loading || !q.trim()}
          className="btn-press h-9 gap-1.5 bg-[var(--desk-live)] text-[var(--desk-accent-fg,#131722)] hover:brightness-110"
        >
          <Search className="size-3.5" />
          {loading ? "Searching…" : "Search"}
        </Button>
        {remaining != null && !limitHit ? (
          <span className="font-mono text-[0.68rem] text-[var(--desk-text-dim)]">
            {remaining} left
          </span>
        ) : null}
      </form>

      {error ? (
        <div className="mt-3 rounded-md border border-[var(--desk-border)] bg-[var(--desk-overlay-soft)] px-3 py-2">
          <p className="text-sm text-[var(--desk-text-secondary)]">{error}</p>
          {limitHit ? (
            <Link
              href={signInHref}
              className="mt-2 inline-flex font-mono text-xs font-semibold text-[var(--desk-link)] underline-offset-4 hover:underline"
            >
              Sign in for unlimited search →
            </Link>
          ) : null}
        </div>
      ) : null}

      {hits ? (
        hits.length === 0 ? (
          <p className="mt-3 font-mono text-xs text-[var(--desk-text-dim)]">
            No recent catalysts for that symbol in the desk yet.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-[var(--desk-border)] overflow-hidden rounded-md border border-[var(--desk-border)]">
            {hits.map((hit) => (
              <li key={hit.id} className="px-3 py-2.5">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-mono text-xs font-semibold text-[var(--desk-text)]">
                    {hit.symbol ?? "—"}
                  </span>
                  {hit.category ? (
                    <span className="font-mono text-[0.6rem] tracking-wide text-[var(--desk-text-dim)] uppercase">
                      {hit.category}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 line-clamp-2 text-sm text-[var(--desk-text-secondary)]">
                  {hit.title}
                </p>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
