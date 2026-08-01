"use client";

import { useState } from "react";
import { BellOff, Plus, Sparkles, Volume2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { criteriaSummary } from "@/lib/watchlist/criteria-display";
import { cn } from "@/lib/utils";

import type { SavedWatchlist } from "./watchlist-card";

/**
 * Quiet mode config, deliberately separate from the watchlist library: what it
 * does, the on/off switch, the always-on "my symbols" list, and which saved
 * watchlists count as signal.
 */
export function QuietModePanel({
  quietMode,
  symbols,
  watchlists,
  selectedIds,
  legacyCategoryCount,
  busy,
  onToggleQuiet,
  onAddSymbol,
  onRemoveSymbol,
  onToggleWatchlist,
  onMigrateLegacy,
  onGoToWatchlists,
}: {
  quietMode: boolean;
  symbols: { id: number; symbol: string }[];
  watchlists: SavedWatchlist[];
  selectedIds: number[];
  legacyCategoryCount: number;
  busy: boolean;
  onToggleQuiet: () => void;
  onAddSymbol: (symbol: string) => Promise<void>;
  onRemoveSymbol: (symbol: string) => Promise<void>;
  onToggleWatchlist: (id: number) => void;
  onMigrateLegacy: () => Promise<void>;
  onGoToWatchlists: () => void;
}) {
  const [draft, setDraft] = useState("");

  const selectedCount = watchlists.filter((w) =>
    selectedIds.includes(w.id),
  ).length;

  async function submitSymbol(e: React.FormEvent) {
    e.preventDefault();
    const symbol = draft.trim().toUpperCase();
    if (!symbol) return;
    await onAddSymbol(symbol);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-4">
      {/* What it does + master switch */}
      <section className="overflow-hidden rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)]">
        <div className="flex flex-wrap items-start justify-between gap-4 p-4 sm:p-5">
          <div className="flex min-w-0 gap-3">
            <span
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-lg border",
                quietMode
                  ? "border-[var(--desk-live)]/45 bg-[var(--desk-live)]/10 text-[var(--desk-live)]"
                  : "border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] text-[var(--desk-text-muted)]",
              )}
            >
              {quietMode ? (
                <BellOff className="size-4" aria-hidden />
              ) : (
                <Volume2 className="size-4" aria-hidden />
              )}
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-[var(--desk-text)]">
                Quiet mode {quietMode ? "is on" : "is off"}
              </h2>
              <p className="mt-1 max-w-lg text-sm text-[var(--desk-text-muted)]">
                {quietMode
                  ? "The Live tape only shows events matching your signal sources below. Everything else is hidden until you turn it off."
                  : "Turn this on when the tape gets noisy — it keeps only the events matching the signal sources you pick below."}
              </p>
              <p className="mt-2.5 inline-flex flex-wrap items-center gap-1.5 rounded-md border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-2 py-1 font-mono text-[0.68rem] text-[var(--desk-text-secondary)]">
                <span>
                  Signal: {symbols.length} symbol
                  {symbols.length === 1 ? "" : "s"} · {selectedCount} watchlist
                  {selectedCount === 1 ? "" : "s"}
                </span>
                {symbols.length === 0 && selectedCount === 0 ? (
                  <span className="text-[var(--desk-text-dim)]">
                    · falling back to high-signal event types
                  </span>
                ) : null}
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={quietMode}
            aria-label="Toggle quiet mode"
            disabled={busy}
            onClick={onToggleQuiet}
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200",
              quietMode
                ? "bg-[var(--desk-live)]"
                : "bg-[var(--desk-overlay-strong)]",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "absolute top-1 left-1 size-5 rounded-full bg-[#121212] shadow transition-transform duration-200",
                quietMode && "translate-x-5",
              )}
            />
          </button>
        </div>
      </section>

      {/* My symbols */}
      <section className="overflow-hidden rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)]">
        <div className="border-b border-[var(--desk-border)] px-4 py-4 sm:px-5">
          <h2 className="text-sm font-semibold text-[var(--desk-text)]">
            My symbols
          </h2>
          <p className="mt-1 text-sm text-[var(--desk-text-muted)]">
            Names you always want to hear about. Also powers the dashboard rail
            and “watchlist only” alert rules.
          </p>
        </div>
        <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
          <form onSubmit={submitSymbol} className="flex items-center gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a symbol…"
              aria-label="Add symbol"
              className="h-9 w-40 border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] font-mono text-xs uppercase"
            />
            <Button
              type="submit"
              disabled={busy || !draft.trim()}
              className="btn-press h-9 gap-1.5 bg-[var(--desk-live)] text-[#121212] hover:brightness-110"
            >
              <Plus className="size-3.5" />
              Add
            </Button>
          </form>
          {symbols.length === 0 ? (
            <p className="font-mono text-xs text-[var(--desk-text-dim)]">
              No symbols yet — quiet mode will rely on the watchlists you select
              below.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {symbols.map((s) => (
                <li
                  key={s.id}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-2 py-1 font-mono text-xs text-[var(--desk-text)]"
                >
                  {s.symbol}
                  <button
                    type="button"
                    aria-label={`Remove ${s.symbol}`}
                    disabled={busy}
                    onClick={() => void onRemoveSymbol(s.symbol)}
                    className="text-[var(--desk-text-muted)] hover:text-[var(--desk-text)]"
                  >
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Signal watchlists */}
      <section className="overflow-hidden rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)]">
        <div className="border-b border-[var(--desk-border)] px-4 py-4 sm:px-5">
          <h2 className="text-sm font-semibold text-[var(--desk-text)]">
            Signal watchlists
          </h2>
          <p className="mt-1 text-sm text-[var(--desk-text-muted)]">
            Any watchlist you switch on here also counts as signal — an event
            passes quiet mode if it matches your symbols <em>or</em> any
            selected watchlist.
          </p>
        </div>
        <div className="flex flex-col gap-2 px-4 py-4 sm:px-5">
          {watchlists.length === 0 ? (
            <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-3 py-3">
              <p className="text-sm text-[var(--desk-text-muted)]">
                You don’t have any watchlists yet.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={onGoToWatchlists}
                className="h-8 border-[var(--desk-border-strong)] text-xs"
              >
                Create one
              </Button>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {watchlists.map((w) => {
                const on = selectedIds.includes(w.id);
                return (
                  <li key={w.id}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      disabled={busy}
                      onClick={() => onToggleWatchlist(w.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                        on
                          ? "border-[var(--desk-live)]/45 bg-[var(--desk-live)]/10"
                          : "border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] hover:bg-[var(--desk-overlay-strong)]",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                          on
                            ? "bg-[var(--desk-live)]"
                            : "bg-[var(--desk-overlay-strong)]",
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 left-0.5 size-4 rounded-full bg-[#121212] shadow transition-transform",
                            on && "translate-x-4",
                          )}
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-[var(--desk-text)]">
                          {w.name}
                        </span>
                        <span className="mt-0.5 block truncate font-mono text-[0.68rem] text-[var(--desk-text-dim)]">
                          {criteriaSummary(w.criteria)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {legacyCategoryCount > 0 ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onMigrateLegacy()}
              className="inline-flex items-center gap-1.5 self-start rounded-md border border-[var(--desk-border)] px-2.5 py-1.5 font-mono text-[0.7rem] text-[var(--desk-text-muted)] transition-colors hover:border-[var(--desk-border-strong)] hover:text-[var(--desk-text)]"
            >
              <Sparkles className="size-3" />
              Convert my old {legacyCategoryCount} playbook categories into a
              watchlist
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
