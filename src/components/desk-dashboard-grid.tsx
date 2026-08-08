"use client";

import { useState } from "react";
import { CalendarDays, PanelRightOpen } from "lucide-react";

import { DashboardEconomicCalendar } from "@/components/dashboard-economic-calendar";
import { DashboardWatchlistRail } from "@/components/dashboard-watchlist-rail";
import {
  LiveCatalystFeed,
  type FeedCatalyst,
} from "@/components/live-catalyst-feed";
import type { WatchlistCriteria } from "@/db/schema";
import { useCalendarRailVisible } from "@/hooks/use-calendar-rail-visible";
import type { MacroEventDef } from "@/lib/jobs/fetch-macro-calendar";
import { cn } from "@/lib/utils";

/**
 * Trading-desk dashboard shell for `/catalyst-feed` — two-column layout
 * aligned to `docs/design/dashboard-target-reference-02.png`: a broadened
 * center Live tape plus a right rail (Economic Calendar + Watchlists).
 * Charting stays available in the row split/detail panel only; the former
 * Live Squawk placeholder and Market Data tab strip are removed.
 *
 * Laptop (`xl:` / 1280+): Economic Calendar rail (user-hideable, preference
 * in localStorage). Wide desktop (`2xl:`): calendar + watchlists.
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
  const { visible: calendarVisible, setVisible: setCalendarVisible } =
    useCalendarRailVisible();

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
        />

        <aside
          className={cn(
            "hidden min-h-0 shrink-0 flex-col gap-3 xl:flex",
            calendarVisible ? "w-[240px] 2xl:w-[300px]" : "w-9 2xl:w-[300px]",
          )}
        >
          {calendarVisible ? (
            <DashboardEconomicCalendar
              events={macroEvents}
              onHide={() => setCalendarVisible(false)}
              className="min-h-0 flex-1 xl:max-h-none 2xl:max-h-[42%] 2xl:min-h-[200px] 2xl:flex-none 2xl:shrink-0"
            />
          ) : (
            <>
              {/* Laptop: slim edge control to restore the calendar. */}
              <button
                type="button"
                onClick={() => setCalendarVisible(true)}
                title="Show economic calendar"
                aria-label="Show economic calendar"
                className={cn(
                  "btn-press flex min-h-0 flex-1 flex-col items-center gap-2 rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)] py-3 text-[var(--desk-text-muted)] transition-colors",
                  "hover:border-[var(--desk-border-strong)] hover:bg-[var(--desk-overlay-soft)] hover:text-[var(--desk-text)]",
                  "2xl:hidden",
                )}
              >
                <PanelRightOpen className="size-3.5 shrink-0" />
                <CalendarDays className="size-3.5 shrink-0" />
                <span
                  className="desk-caps mt-1 font-mono text-[0.62rem] tracking-[0.14em] text-inherit uppercase"
                  style={{ writingMode: "vertical-rl" }}
                >
                  Calendar
                </span>
              </button>

              {/* Wide desk: compact bar above watchlists. */}
              <button
                type="button"
                onClick={() => setCalendarVisible(true)}
                title="Show economic calendar"
                aria-label="Show economic calendar"
                className={cn(
                  "btn-press hidden items-center justify-between gap-2 rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)] px-3 py-2.5 text-[var(--desk-text-muted)] transition-colors 2xl:flex",
                  "hover:border-[var(--desk-border-strong)] hover:bg-[var(--desk-overlay-soft)] hover:text-[var(--desk-text)]",
                )}
              >
                <span className="desk-caps flex items-center gap-1.5 font-mono text-[0.7rem] font-semibold tracking-[0.14em] uppercase">
                  <CalendarDays className="size-3.5" />
                  Economic Calendar
                </span>
                <PanelRightOpen className="size-3.5 shrink-0" />
              </button>
            </>
          )}

          <div className="hidden min-h-0 flex-1 flex-col 2xl:flex">
            <DashboardWatchlistRail
              focusSymbol={focusSymbol}
              onFocusSymbol={setFocusSymbol}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
