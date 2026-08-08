"use client";

import { useState } from "react";

import { DashboardEconomicCalendar } from "@/components/dashboard-economic-calendar";
import { DashboardWatchlistRail } from "@/components/dashboard-watchlist-rail";
import {
  LiveCatalystFeed,
  type FeedCatalyst,
} from "@/components/live-catalyst-feed";
import type { WatchlistCriteria } from "@/db/schema";
import type { MacroEventDef } from "@/lib/jobs/fetch-macro-calendar";
import { cn } from "@/lib/utils";

/**
 * Trading-desk dashboard shell for `/catalyst-feed` — two-column layout
 * aligned to `docs/design/dashboard-target-reference-02.png`: a broadened
 * center Live tape plus a right rail (Economic Calendar + Watchlists).
 * Charting stays available in the row split/detail panel only; the former
 * Live Squawk placeholder and Market Data tab strip are removed.
 *
 * Laptop (`xl:` / 1280+): narrow calendar rail when the split is closed.
 * Wide desktop (`2xl:`): calendar + watchlists. While the split is open the
 * rail yields so tape titles stay readable (Watchlists still at `/watchlist`).
 */
export function DeskDashboardGrid({
  initialCatalysts,
  isAdmin,
  showSourceLabels = false,
  initialSymbolFilter,
  initialWatchlistCriteria,
  initialSelectedId,
  macroEvents,
}: {
  initialCatalysts: FeedCatalyst[];
  isAdmin: boolean;
  /** Admin personal pref: show vendor source on tape / split / details. */
  showSourceLabels?: boolean;
  initialSymbolFilter?: string;
  /** Full filter combo applied from a saved watchlist's "Apply to feed". */
  initialWatchlistCriteria?: WatchlistCriteria;
  initialSelectedId?: number;
  macroEvents: MacroEventDef[];
}) {
  const [focusSymbol, setFocusSymbol] = useState<string | null>(
    initialSymbolFilter?.trim().toUpperCase() || null,
  );
  const [splitOpen, setSplitOpen] = useState(Boolean(initialSelectedId));

  return (
    <div className="desk-dashboard flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex min-h-0 flex-1 flex-col gap-3 xl:flex-row">
        <LiveCatalystFeed
          initialCatalysts={initialCatalysts}
          isAdmin={isAdmin}
          showSourceLabels={showSourceLabels}
          initialSymbolFilter={initialSymbolFilter}
          initialWatchlistCriteria={initialWatchlistCriteria}
          initialSelectedId={initialSelectedId}
          onFocusSymbol={setFocusSymbol}
          onSplitOpenChange={setSplitOpen}
        />

        <div
          className={cn(
            "hidden min-h-0 w-[240px] shrink-0 flex-col gap-3 2xl:w-[300px]",
            // Yield the rail while triaging a row so laptop tape stays wide.
            !splitOpen && "xl:flex",
          )}
        >
          <DashboardEconomicCalendar
            events={macroEvents}
            className="min-h-0 flex-1 xl:max-h-none 2xl:max-h-[42%] 2xl:min-h-[200px] 2xl:flex-none 2xl:shrink-0"
          />
          <div className="hidden min-h-0 flex-1 flex-col 2xl:flex">
            <DashboardWatchlistRail
              focusSymbol={focusSymbol}
              onFocusSymbol={setFocusSymbol}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
