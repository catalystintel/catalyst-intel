"use client";

import { BookmarkPlus, ListPlus, Star } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** One saved (rule-based) watchlist, from the symbol's point of view. */
export interface WatchlistDestination {
  id: number;
  name: string;
  /** Symbol is an explicit member of this watchlist's `criteria.symbols`. */
  checked: boolean;
}

/**
 * Shared "which watchlist(s)?" checklist — a symbol can belong to zero, one,
 * or many saved watchlists at once, plus the legacy flat "My symbols" quick
 * list (still the default quiet-mode / dashboard-rail source). Rendered
 * inside either a `DropdownMenuSubContent` (nested in the row's action menu)
 * or a standalone `DropdownMenuContent` (the tape's quick "Watch" button) —
 * see `AddToWatchlistSubmenu` / `AddToWatchlistButton` below.
 */
function WatchlistDestinationList({
  symbol,
  flatChecked,
  destinations,
  onToggleFlat,
  onToggleSaved,
  onCreateNew,
}: {
  symbol: string;
  flatChecked: boolean;
  destinations: WatchlistDestination[];
  onToggleFlat: () => void;
  onToggleSaved: (destination: WatchlistDestination) => void;
  onCreateNew: () => void;
}) {
  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel className="font-mono text-[0.62rem] tracking-[0.1em] text-[var(--desk-text-dim)] uppercase">
          Add {symbol} to…
        </DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          className="font-mono text-[0.72rem]"
          checked={flatChecked}
          onCheckedChange={onToggleFlat}
          onClick={(e) => e.stopPropagation()}
        >
          <Star className="size-3.5" />
          My symbols
        </DropdownMenuCheckboxItem>
        {destinations.length > 0 ? (
          <>
            <DropdownMenuSeparator className="bg-[var(--desk-border)]" />
            {destinations.map((d) => (
              <DropdownMenuCheckboxItem
                key={d.id}
                className="font-mono text-[0.72rem]"
                checked={d.checked}
                onCheckedChange={() => onToggleSaved(d)}
                onClick={(e) => e.stopPropagation()}
              >
                <span className="min-w-0 truncate">{d.name}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </>
        ) : null}
      </DropdownMenuGroup>
      <DropdownMenuSeparator className="bg-[var(--desk-border)]" />
      <DropdownMenuItem
        className="font-mono text-[0.72rem]"
        onClick={onCreateNew}
      >
        <ListPlus className="size-3.5" />
        New watchlist…
      </DropdownMenuItem>
    </>
  );
}

/** Nested inside an existing `DropdownMenu` (e.g. `SymbolActionMenu`). */
export function AddToWatchlistSubmenu({
  symbol,
  flatChecked,
  destinations,
  onToggleFlat,
  onToggleSaved,
  onCreateNew,
}: {
  symbol: string;
  flatChecked: boolean;
  destinations: WatchlistDestination[];
  onToggleFlat: () => void;
  onToggleSaved: (destination: WatchlistDestination) => void;
  onCreateNew: () => void;
}) {
  const count =
    (flatChecked ? 1 : 0) + destinations.filter((d) => d.checked).length;
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="font-mono text-[0.72rem]">
        <BookmarkPlus className="size-3.5" />
        Watchlists
        {count > 0 ? (
          <span className="ml-auto rounded-full bg-[var(--desk-overlay-strong)] px-1.5 font-mono text-[0.6rem] text-[var(--desk-text-muted)]">
            {count}
          </span>
        ) : null}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="min-w-56 border-[var(--desk-border)] bg-popover text-[var(--desk-text)]">
        <WatchlistDestinationList
          symbol={symbol}
          flatChecked={flatChecked}
          destinations={destinations}
          onToggleFlat={onToggleFlat}
          onToggleSaved={onToggleSaved}
          onCreateNew={onCreateNew}
        />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

/** Standalone trigger (e.g. the tape row's quick "Watch" action button). */
export function AddToWatchlistButton({
  symbol,
  flatChecked,
  destinations,
  onToggleFlat,
  onToggleSaved,
  onCreateNew,
  children,
  className,
}: {
  symbol: string;
  flatChecked: boolean;
  destinations: WatchlistDestination[];
  onToggleFlat: () => void;
  onToggleSaved: (destination: WatchlistDestination) => void;
  onCreateNew: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn("shrink-0", className)}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-56 border-[var(--desk-border)] bg-popover text-[var(--desk-text)]"
        onClick={(e) => e.stopPropagation()}
      >
        <WatchlistDestinationList
          symbol={symbol}
          flatChecked={flatChecked}
          destinations={destinations}
          onToggleFlat={onToggleFlat}
          onToggleSaved={onToggleSaved}
          onCreateNew={onCreateNew}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
