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
 * When a feed row opens the split, the calendar rail vanishes transiently
 * (saved preference untouched) so triage / chart can use the right side.
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
  const [splitOpen, setSplitOpen] = useState(false);
  const { visible: calendarVisible, setVisible: setCalendarVisible } =
    useCalendarRailVisible();
  // Transient override while split is open — never writes localStorage;
  // closing the split restores the saved preference.
  const effectiveCalendarVisible = calendarVisible && !splitOpen;

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
          calendarRailHidden={!effectiveCalendarVisible}
          onShowCalendarRail={
            splitOpen ? undefined : () => setCalendarVisible(true)
          }
        />

        <aside
          className={cn(
            "min-h-0 shrink-0 flex-col gap-3",
            // Feed click → vanish the rail so split/chart use the right budget.
            splitOpen
              ? "hidden"
              : effectiveCalendarVisible
                ? "hidden w-[240px] xl:flex 2xl:w-[300px]"
                : "hidden w-10 xl:flex 2xl:w-[300px]",
          )}
        >
          {effectiveCalendarVisible ? (
            <DashboardEconomicCalendar
              events={macroEvents}
              onHide={() => setCalendarVisible(false)}
              className="min-h-0 flex-1 xl:max-h-none 2xl:max-h-[42%] 2xl:min-h-[200px] 2xl:flex-none 2xl:shrink-0"
            />
          ) : (
            <>
              {/* Laptop: slim edge control — secondary to the feed header button. */}
              <button
                type="button"
                onClick={() => setCalendarVisible(true)}
                title="Show economic calendar"
                aria-label="Show economic calendar"
                className={cn(
                  "btn-press flex min-h-0 flex-1 flex-col items-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--desk-live)_35%,var(--desk-border))] bg-[color-mix(in_srgb,var(--desk-live)_8%,var(--desk-panel))] py-3 text-[var(--desk-live)] transition-colors",
                  "hover:border-[color-mix(in_srgb,var(--desk-live)_55%,var(--desk-border))] hover:bg-[color-mix(in_srgb,var(--desk-live)_12%,var(--desk-panel))]",
                  "2xl:hidden",
                )}
              >
                <PanelRightOpen className="size-3.5 shrink-0" />
                <CalendarDays className="size-3.5 shrink-0" />
                <span
                  className="desk-caps mt-1 font-mono text-[0.62rem] tracking-[0.14em] text-inherit uppercase"
                  style={{ writingMode: "vertical-rl" }}
                >
                  Show
                </span>
              </button>

              {/* Wide desk: compact bar above watchlists. */}
              <button
                type="button"
                onClick={() => setCalendarVisible(true)}
                title="Show economic calendar"
                aria-label="Show economic calendar"
                className={cn(
                  "btn-press hidden items-center justify-between gap-2 rounded-xl border border-[color-mix(in_srgb,var(--desk-live)_35%,var(--desk-border))] bg-[color-mix(in_srgb,var(--desk-live)_8%,var(--desk-panel))] px-3 py-2.5 text-[var(--desk-live)] transition-colors 2xl:flex",
                  "hover:border-[color-mix(in_srgb,var(--desk-live)_55%,var(--desk-border))] hover:bg-[color-mix(in_srgb,var(--desk-live)_12%,var(--desk-panel))]",
                )}
              >
                <span className="desk-caps flex items-center gap-1.5 font-mono text-[0.7rem] font-semibold tracking-[0.14em] uppercase">
                  <CalendarDays className="size-3.5" />
                  Show calendar
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
