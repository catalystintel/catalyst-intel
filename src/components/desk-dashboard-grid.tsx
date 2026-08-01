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

/**
 * Trading-desk dashboard shell for `/catalyst-feed` — two-column layout
 * aligned to `docs/design/dashboard-target-reference-02.png`: a broadened
 * center Live tape plus a right rail (Economic Calendar + Watchlists).
 * Charting stays available in the row split/detail panel only; the former
 * Live Squawk placeholder and Market Data tab strip are removed.
 *
 * Extra panels are desktop-only (`xl:` and up); mobile/tablet stay
 * single-column Live tape + split (Watchlists still at `/watchlist`).
 */
export function DeskDashboardGrid({
  initialCatalysts,
  isAdmin,
  initialSymbolFilter,
  initialWatchlistCriteria,
  initialSelectedId,
  macroEvents,
}: {
  initialCatalysts: FeedCatalyst[];
  isAdmin: boolean;
  initialSymbolFilter?: string;
  /** Full filter combo applied from a saved watchlist's "Apply to feed". */
  initialWatchlistCriteria?: WatchlistCriteria;
  initialSelectedId?: number;
  macroEvents: MacroEventDef[];
}) {
  const [focusSymbol, setFocusSymbol] = useState<string | null>(
    initialSymbolFilter?.trim().toUpperCase() || null,
  );

  return (
    <div className="desk-dashboard flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex min-h-0 flex-1 flex-col gap-3 xl:flex-row">
        <LiveCatalystFeed
          initialCatalysts={initialCatalysts}
          isAdmin={isAdmin}
          initialSymbolFilter={initialSymbolFilter}
          initialWatchlistCriteria={initialWatchlistCriteria}
          initialSelectedId={initialSelectedId}
          onFocusSymbol={setFocusSymbol}
        />

        <div className="hidden min-h-0 w-[300px] shrink-0 flex-col gap-3 xl:flex 2xl:w-[340px]">
          <DashboardEconomicCalendar events={macroEvents} />
          <DashboardWatchlistRail
            focusSymbol={focusSymbol}
            onFocusSymbol={setFocusSymbol}
          />
        </div>
      </div>
    </div>
  );
}
