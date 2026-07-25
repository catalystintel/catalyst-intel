"use client";

import { useRouter } from "next/navigation";
import { BookOpen, Filter, PanelRight, Plus, X } from "lucide-react";

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
  onWatchlist,
  onFilterToSymbol,
  onOpenPanel,
  onOpenArticle,
  onAddWatchlist,
  onDismiss,
}: {
  symbol: string;
  /** Display name for hover + menu header (optional). */
  companyName?: string | null;
  catalystId: number;
  onWatchlist: boolean;
  onFilterToSymbol: () => void;
  onOpenPanel: () => void;
  /** Prefer in-place details modal over navigating away. */
  onOpenArticle?: () => void;
  onAddWatchlist: () => void;
  onDismiss: () => void;
}) {
  const router = useRouter();
  const name = companyName?.trim() || null;
  const hoverLabel = name ? `${symbol} · ${name}` : `${symbol} actions`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "group/symbol relative truncate font-mono text-[0.88rem] font-semibold tracking-tight text-[var(--desk-text)] transition-colors",
          "hover:text-[var(--desk-live)] focus-visible:text-[var(--desk-live)] focus-visible:outline-none",
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
              "rounded-sm border border-[var(--desk-border-strong)] bg-[var(--desk-panel)] px-2 py-1",
              "font-sans text-[0.68rem] leading-snug font-normal tracking-normal text-[var(--desk-text-secondary)] shadow-md",
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
        className="min-w-52 border-[var(--desk-border)] bg-[var(--desk-panel)] text-[var(--desk-text)]"
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
        <DropdownMenuItem
          className="font-mono text-[0.72rem]"
          disabled={onWatchlist}
          onClick={onAddWatchlist}
        >
          <Plus className="size-3.5" />
          {onWatchlist ? "On watchlist" : "Add to watchlist"}
        </DropdownMenuItem>
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
