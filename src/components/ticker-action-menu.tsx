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
 * Ticker cell menu: filter tape, open panel/article, watchlist, dismiss.
 */
export function TickerActionMenu({
  ticker,
  catalystId,
  onWatchlist,
  onFilterToTicker,
  onOpenPanel,
  onAddWatchlist,
  onDismiss,
}: {
  ticker: string;
  catalystId: number;
  onWatchlist: boolean;
  onFilterToTicker: () => void;
  onOpenPanel: () => void;
  onAddWatchlist: () => void;
  onDismiss: () => void;
}) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "truncate font-mono text-[0.88rem] font-semibold tracking-tight text-[var(--desk-text)] transition-colors",
          "hover:text-[var(--desk-live)] focus-visible:text-[var(--desk-live)] focus-visible:outline-none",
          "-mx-0.5 rounded-sm px-0.5",
        )}
        aria-label={`${ticker} actions`}
        title="Ticker actions"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {ticker}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-48 border-[var(--desk-border)] bg-[var(--desk-panel)] text-[var(--desk-text)]"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuItem
          className="font-mono text-[0.72rem]"
          onClick={onFilterToTicker}
        >
          <Filter className="size-3.5" />
          Filter tape to {ticker}
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
          onClick={() => router.push(`/dashboard/catalyst/${catalystId}`)}
        >
          <BookOpen className="size-3.5" />
          Open full article
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
