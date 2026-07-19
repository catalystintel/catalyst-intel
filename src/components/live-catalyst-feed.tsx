"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";

export type FeedCatalyst = {
  id: number;
  ticker: string | null;
  type: string;
  title: string;
  timestamp: string;
};

const ACTIVE_POLL_MS = 20_000;
const BLURRED_POLL_MS = 90_000;

type Presence = "active" | "blurred" | "hidden";

function readPresence(): Presence {
  if (typeof document === "undefined") return "active";
  if (document.visibilityState === "hidden") return "hidden";
  if (typeof document.hasFocus === "function" && !document.hasFocus()) {
    return "blurred";
  }
  return "active";
}

export function LiveCatalystFeed({
  initialCatalysts,
  isAdmin,
}: {
  initialCatalysts: FeedCatalyst[];
  isAdmin: boolean;
}) {
  const [catalysts, setCatalysts] = useState(initialCatalysts);
  const [presence, setPresence] = useState<Presence>("active");
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const softRefetch = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/catalysts?limit=50", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await res.json();
      if (res.status === 429) {
        setPollError(data.error ?? "Rate limited — polling will retry.");
        return;
      }
      if (!res.ok) {
        throw new Error(data.error ?? "Could not refresh feed.");
      }
      setCatalysts(data.catalysts ?? []);
      setLastFetchedAt(data.fetchedAt ?? new Date().toISOString());
      setPollError(null);
    } catch (err) {
      setPollError(err instanceof Error ? err.message : "Could not refresh feed.");
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    const syncPresence = () => setPresence(readPresence());
    syncPresence();

    document.addEventListener("visibilitychange", syncPresence);
    window.addEventListener("focus", syncPresence);
    window.addEventListener("blur", syncPresence);

    return () => {
      document.removeEventListener("visibilitychange", syncPresence);
      window.removeEventListener("focus", syncPresence);
      window.removeEventListener("blur", syncPresence);
    };
  }, []);

  useEffect(() => {
    if (presence === "hidden") return;

    const intervalMs = presence === "active" ? ACTIVE_POLL_MS : BLURRED_POLL_MS;

    // Defer the immediate soft-refetch so we don't setState synchronously in the effect body.
    const immediateId =
      presence === "active"
        ? window.setTimeout(() => {
            void softRefetch();
          }, 0)
        : null;

    const id = window.setInterval(() => {
      void softRefetch();
    }, intervalMs);

    return () => {
      if (immediateId !== null) window.clearTimeout(immediateId);
      window.clearInterval(id);
    };
  }, [presence, softRefetch]);

  const statusLabel =
    presence === "hidden"
      ? "Paused (tab hidden)"
      : presence === "blurred"
        ? "Slow poll (unfocused)"
        : "Live";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <span
            aria-hidden
            className={
              presence === "active"
                ? "inline-block size-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                : "inline-block size-1.5 rounded-full bg-muted-foreground/50"
            }
          />
          <span>{statusLabel}</span>
          {lastFetchedAt ? (
            <span className="tabular-nums">
              · updated {new Date(lastFetchedAt).toLocaleTimeString()}
            </span>
          ) : null}
        </div>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {catalysts.length} shown
        </span>
      </div>

      {pollError ? (
        <p className="text-xs text-amber-400/90">{pollError}</p>
      ) : null}

      {catalysts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 bg-card/20 p-12 text-center">
          <p className="text-sm font-medium">No catalysts yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {isAdmin
              ? "Open Admin and run “Fetch SEC EDGAR now” to populate the feed."
              : "Data will appear here once an admin runs the first ingestion job."}
          </p>
        </div>
      ) : (
        <CatalystFeedTable catalysts={catalysts} />
      )}
    </div>
  );
}

function CatalystFeedTable({ catalysts }: { catalysts: FeedCatalyst[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card/40">
      <div className="grid grid-cols-[5rem_5.5rem_1fr_6.5rem] gap-3 border-b border-border/70 bg-secondary/40 px-4 py-2.5 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground sm:grid-cols-[6rem_6.5rem_1fr_7.5rem] sm:px-5">
        <span>Ticker</span>
        <span>Type</span>
        <span>Event</span>
        <span className="text-right">Filed</span>
      </div>
      <ul className="divide-y divide-border/50">
        {catalysts.map((catalyst, index) => (
          <li
            key={catalyst.id}
            className="feed-row grid grid-cols-[5rem_5.5rem_1fr_6.5rem] items-center gap-3 px-4 py-3 transition-colors hover:bg-amber-400/[0.04] sm:grid-cols-[6rem_6.5rem_1fr_7.5rem] sm:px-5"
            style={{ animationDelay: `${Math.min(index, 24) * 28}ms` }}
          >
            <div>
              {catalyst.ticker ? (
                <Badge
                  variant="secondary"
                  className="rounded-md border border-steel/40 bg-steel/15 font-mono text-[0.7rem] text-steel-foreground"
                >
                  {catalyst.ticker}
                </Badge>
              ) : (
                <span className="font-mono text-xs text-muted-foreground">—</span>
              )}
            </div>
            <span className="truncate font-mono text-xs text-muted-foreground">
              {catalyst.type}
            </span>
            <span className="truncate text-sm text-foreground/95">{catalyst.title}</span>
            <time className="text-right font-mono text-xs text-muted-foreground tabular-nums">
              {new Date(catalyst.timestamp).toLocaleDateString()}
            </time>
          </li>
        ))}
      </ul>
    </div>
  );
}
