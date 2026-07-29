"use client";

import { useState } from "react";

import { DashboardChartingPanel } from "@/components/dashboard-charting-panel";
import { DashboardEconomicCalendar } from "@/components/dashboard-economic-calendar";
import { DashboardMarketDataTabs } from "@/components/dashboard-market-data-tabs";
import { DashboardSquawkPanel } from "@/components/dashboard-squawk-panel";
import { DashboardTickerTape } from "@/components/dashboard-ticker-tape";
import { DashboardWatchlistRail } from "@/components/dashboard-watchlist-rail";
import {
  LiveCatalystFeed,
  type FeedCatalyst,
} from "@/components/live-catalyst-feed";
import type { MacroEventDef } from "@/lib/jobs/fetch-macro-calendar";

/**
 * Trading-desk dashboard shell for `/catalyst-feed` — restyled/composed per
 * `docs/design/dashboard-target-reference-01.png` + the prelogin dark/gold
 * guidelines. Keeps the existing Live tape (`LiveCatalystFeed`) as the
 * center column unchanged in behavior, and adds real-data side panels
 * (Watchlist rail, Economic Calendar, Charting, ticker tape) plus an
 * honestly-labeled Live Squawk placeholder — see each panel's own file for
 * what's real vs. placeholder.
 *
 * The extra panels are desktop-only (`xl:` and up) so the mobile/tablet
 * experience is unchanged from today's single-column Live tape + split
 * panel (those panels also remain reachable via their own full pages —
 * `/watchlist`, etc.).
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
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <DashboardMarketDataTabs active="live" isAdmin={isAdmin} />

      <div className="flex min-h-0 flex-1 flex-col gap-3 xl:flex-row">
        <div className="hidden min-h-0 w-[260px] shrink-0 flex-col gap-3 xl:flex">
          <DashboardSquawkPanel />
          <DashboardWatchlistRail
            focusSymbol={focusSymbol}
            onFocusSymbol={setFocusSymbol}
            onSymbolsChange={setWatchlistSymbols}
          />
        </div>

        <LiveCatalystFeed
          initialCatalysts={initialCatalysts}
          isAdmin={isAdmin}
          initialSymbolFilter={initialSymbolFilter}
          initialSelectedId={initialSelectedId}
          onFocusSymbol={setFocusSymbol}
        />

        <div className="hidden min-h-0 w-[320px] shrink-0 flex-col gap-3 xl:flex">
          <DashboardEconomicCalendar events={macroEvents} />
          <DashboardChartingPanel
            symbol={focusSymbol}
            onSymbolChange={setFocusSymbol}
          />
        </div>
      </div>

      <div className="hidden xl:block">
        <DashboardTickerTape symbols={watchlistSymbols} />
      </div>
    </div>
  );
}
