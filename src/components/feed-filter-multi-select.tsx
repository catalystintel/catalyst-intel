"use client";

import { useMemo, useState } from "react";
import { ChevronsUpDown, X } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface FeedFilterOption {
  value: string;
  label: string;
  count?: number;
}

/**
 * Searchable multi-select for live-tape facet filters (industries, categories,
 * forms, sources). Shows selected count on the trigger.
 */
export function FeedFilterMultiSelect({
  label,
  options,
  selected,
  onChange,
  emptyLabel,
  searchPlaceholder = "Search…",
}: {
  label: string;
  options: FeedFilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  emptyLabel?: string;
  searchPlaceholder?: string;
}) {
  const [query, setQuery] = useState("");
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  const triggerText =
    selected.length === 0
      ? (emptyLabel ?? `All ${label.toLowerCase()}`)
      : `${label} · ${selected.length}`;

  function toggle(value: string) {
    if (selectedSet.has(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex h-8 items-center gap-1 rounded-md border px-2.5 font-mono text-[0.72rem] tracking-wide transition-colors",
          selected.length > 0
            ? "border-[var(--desk-text-dim)] bg-[var(--desk-overlay-strong)] text-[var(--desk-text)]"
            : "border-[var(--desk-border)] bg-transparent text-[var(--desk-text-muted)] hover:border-[var(--desk-border-strong)] hover:text-[var(--desk-text)]",
        )}
      >
        <span className="max-w-[10rem] truncate">{triggerText}</span>
        <ChevronsUpDown className="size-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-64 border-[var(--desk-border)] bg-[var(--desk-panel)] p-0 text-[var(--desk-text)]"
      >
        <div
          className="border-b border-[var(--desk-border)] p-2"
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] font-mono text-xs"
            aria-label={`Search ${label}`}
          />
        </div>
        <DropdownMenuLabel className="font-mono text-[0.65rem] tracking-wide text-[var(--desk-text-dim)] uppercase">
          {label}
        </DropdownMenuLabel>
        <div className="max-h-56 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="px-2 py-3 font-mono text-[0.7rem] text-[var(--desk-text-dim)]">
              No matches
            </p>
          ) : (
            filtered.map((opt) => (
              <DropdownMenuCheckboxItem
                key={opt.value}
                checked={selectedSet.has(opt.value)}
                onCheckedChange={() => toggle(opt.value)}
                className="font-mono text-[0.72rem] text-[var(--desk-text-secondary)]"
              >
                <span className="flex min-w-0 flex-1 items-center justify-between gap-2 pr-4">
                  <span className="truncate">{opt.label}</span>
                  {typeof opt.count === "number" ? (
                    <span className="shrink-0 tabular-nums opacity-60">
                      {opt.count}
                    </span>
                  ) : null}
                </span>
              </DropdownMenuCheckboxItem>
            ))
          )}
        </div>
        {selected.length > 0 ? (
          <>
            <DropdownMenuSeparator className="bg-[var(--desk-border)]" />
            <button
              type="button"
              onClick={() => onChange([])}
              className="flex w-full items-center gap-1.5 px-2 py-1.5 font-mono text-[0.7rem] text-[var(--desk-text-muted)] hover:bg-[var(--desk-overlay-soft)] hover:text-[var(--desk-text)]"
            >
              <X className="size-3" />
              Clear {label.toLowerCase()}
            </button>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
