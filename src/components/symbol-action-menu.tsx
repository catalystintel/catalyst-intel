"use client";

import { useRouter } from "next/navigation";
import { BookOpen, Filter, PanelRight, X } from "lucide-react";

import {
  AddToWatchlistSubmenu,
  type WatchlistDestination,
} from "@/components/watchlists/add-to-watchlist-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Symbol cell menu: filter tape, open panel/details, watchlist, dismiss.
 * Dropdown opens with symbol + company identity above the actions.
 */
export function SymbolActionMenu({
  symbol,
  companyName = null,
  catalystId,
  watchlistFlatChecked,
  watchlistDestinations,
  onToggleFlatWatchlist,
  onToggleSavedWatchlist,
  onCreateWatchlist,
  onFilterToSymbol,
  onOpenPanel,
  onOpenArticle,
  onDismiss,
}: {
  symbol: string;
  /** Display name for hover + menu header (optional). */
  companyName?: string | null;
  catalystId: number;
  /** Whether symbol is on the legacy flat "My symbols" quick list. */
  watchlistFlatChecked: boolean;
  /** Every saved (rule-based) watchlist + whether symbol is already a member. */
  watchlistDestinations: WatchlistDestination[];
  onToggleFlatWatchlist: () => void;
  onToggleSavedWatchlist: (destination: WatchlistDestination) => void;
  onCreateWatchlist: () => void;
  onFilterToSymbol: () => void;
  onOpenPanel: () => void;
  /** Prefer in-place details modal over navigating away. */
  onOpenArticle?: () => void;
  onDismiss: () => void;
}) {
  const router = useRouter();
  const name = companyName?.trim() || null;
  const hoverLabel = name ? `${symbol} · ${name}` : `${symbol} actions`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "desk-data group/symbol relative truncate font-bold tracking-tight text-[var(--desk-interactive,var(--desk-link,var(--desk-text)))] transition-colors",
          "hover:text-[var(--desk-interactive,var(--desk-link))] focus-visible:text-[var(--desk-interactive,var(--desk-link))] focus-visible:outline-none",
          "-mx-0.5 rounded-sm px-0.5",
        )}
        aria-label={hoverLabel}
        title={hoverLabel}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {symbol}
        {name ? (
          <span
            role="tooltip"
            className={cn(
              "pointer-events-none absolute top-full left-0 z-20 mt-1 max-w-[14rem]",
              "rounded-sm border border-[var(--desk-border-strong)] bg-[var(--desk-tooltip)] px-2 py-1",
              "desk-body font-normal tracking-normal text-[var(--desk-text-secondary)] shadow-md",
              "opacity-0 transition-opacity duration-150",
              "group-hover/symbol:opacity-100 group-focus-visible/symbol:opacity-100",
            )}
          >
            {name}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-52 border-[var(--desk-border)] bg-popover text-[var(--desk-text)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-2.5 py-2">
          <p className="font-mono text-sm font-semibold tracking-tight text-[var(--desk-live)]">
            {symbol}
          </p>
          {name ? (
            <p className="mt-0.5 line-clamp-2 font-sans text-[0.78rem] leading-snug text-[var(--desk-text-secondary)]">
              {name}
            </p>
          ) : (
            <p className="mt-0.5 font-sans text-[0.7rem] text-[var(--desk-text-dim)]">
              Company name unavailable
            </p>
          )}
        </div>
        <DropdownMenuSeparator className="bg-[var(--desk-border)]" />
        <DropdownMenuItem
          className="font-mono text-[0.72rem]"
          onClick={onFilterToSymbol}
        >
          <Filter className="size-3.5" />
          Filter tape to {symbol}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="font-mono text-[0.72rem]"
          onClick={onOpenPanel}
        >
          <PanelRight className="size-3.5" />
          Open side panel
        </DropdownMenuItem>
        <DropdownMenuItem
          className="font-mono text-[0.72rem]"
          onClick={() => {
            if (onOpenArticle) onOpenArticle();
            else router.push(`/catalyst-feed/catalyst/${catalystId}`);
          }}
        >
          <BookOpen className="size-3.5" />
          Open details
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-[var(--desk-border)]" />
        <AddToWatchlistSubmenu
          symbol={symbol}
          flatChecked={watchlistFlatChecked}
          destinations={watchlistDestinations}
          onToggleFlat={onToggleFlatWatchlist}
          onToggleSaved={onToggleSavedWatchlist}
          onCreateNew={onCreateWatchlist}
        />
        <DropdownMenuItem
          className="font-mono text-[0.72rem]"
          variant="destructive"
          onClick={onDismiss}
        >
          <X className="size-3.5" />
          Dismiss
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
