"use client";

import { useState } from "react";

import { DashboardEconomicCalendar } from "@/components/dashboard-economic-calendar";
import {
  LiveCatalystFeed,
  type FeedCatalyst,
} from "@/components/live-catalyst-feed";
import type { WatchlistCriteria } from "@/db/schema";
import { useCalendarRailVisible } from "@/hooks/use-calendar-rail-visible";
import type { MacroEventDef } from "@/lib/jobs/fetch-macro-calendar";
import { cn } from "@/lib/utils";

/**
 * Trading-desk dashboard shell for `/catalyst-feed` — Live tape plus an
 * optional Economic Calendar right rail. Hiding the calendar (X) collapses
 * the rail so the tape expands; the feed-header control restores it.
 * When a feed row opens the split, the rail collapses transiently (saved
 * preference untouched) so triage / chart can use the right side.
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
  const [splitOpen, setSplitOpen] = useState(false);
  const { visible: calendarVisible, setVisible: setCalendarVisible } =
    useCalendarRailVisible();
  // Transient override while split is open — never writes localStorage;
  // closing the split restores the saved preference.
  const railOpen = calendarVisible && !splitOpen;

  return (
    <div className="desk-dashboard flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
        <LiveCatalystFeed
          initialCatalysts={initialCatalysts}
          isAdmin={isAdmin}
          showSourceLabels={showSourceLabels}
          initialSymbolFilter={initialSymbolFilter}
          initialWatchlistCriteria={initialWatchlistCriteria}
          initialSelectedId={initialSelectedId}
          onSplitOpenChange={setSplitOpen}
          calendarRailHidden={!railOpen}
          onShowCalendarRail={
            splitOpen ? undefined : () => setCalendarVisible(true)
          }
        />

        <aside
          aria-hidden={!railOpen}
          className={cn(
            "hidden min-h-0 shrink-0 flex-col overflow-hidden xl:flex",
            "transition-[width,margin-left,opacity] duration-300 ease-in-out",
            railOpen
              ? "ml-3 w-[240px] opacity-100 2xl:w-[300px]"
              : "pointer-events-none ml-0 w-0 opacity-0",
          )}
        >
          <DashboardEconomicCalendar
            events={macroEvents}
            onHide={() => setCalendarVisible(false)}
            className="min-h-0 flex-1"
          />
        </aside>
      </div>
    </div>
  );
}
