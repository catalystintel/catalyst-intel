"use client";

import { useState } from "react";

import { DashboardEconomicCalendar } from "@/components/dashboard-economic-calendar";
import { DashboardTickerTape } from "@/components/dashboard-ticker-tape";
import { DashboardWatchlistRail } from "@/components/dashboard-watchlist-rail";
import {
  LiveCatalystFeed,
  type FeedCatalyst,
} from "@/components/live-catalyst-feed";
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
  initialSelectedId,
  macroEvents,
}: {
  initialCatalysts: FeedCatalyst[];
  isAdmin: boolean;
  initialSymbolFilter?: string;
  initialSelectedId?: number;
  macroEvents: MacroEventDef[];
}) {
  const [focusSymbol, setFocusSymbol] = useState<string | null>(
    initialSymbolFilter?.trim().toUpperCase() || null,
  );
  // Kept in sync by the Watchlist rail's own load/add/remove calls (see
  // `onSymbolsChange`) so the bottom ticker tape reacts immediately instead
  // of only reflecting the watchlist as of first mount.
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>([]);

  return (
    <div className="desk-dashboard flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex min-h-0 flex-1 flex-col gap-3 xl:flex-row">
        <LiveCatalystFeed
          initialCatalysts={initialCatalysts}
          isAdmin={isAdmin}
          initialSymbolFilter={initialSymbolFilter}
          initialSelectedId={initialSelectedId}
          onFocusSymbol={setFocusSymbol}
        />

        <div className="hidden min-h-0 w-[300px] shrink-0 flex-col gap-3 xl:flex 2xl:w-[340px]">
          <DashboardEconomicCalendar events={macroEvents} />
          <DashboardWatchlistRail
            focusSymbol={focusSymbol}
            onFocusSymbol={setFocusSymbol}
            onSymbolsChange={setWatchlistSymbols}
          />
        </div>
      </div>

      <div className="hidden xl:block">
        <DashboardTickerTape symbols={watchlistSymbols} />
      </div>
    </div>
  );
}
