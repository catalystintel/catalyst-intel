"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SkeletonCard } from "@/components/loading-skeleton";
import type { WatchlistCriteria } from "@/db/schema";
import type { QuietSignalWatchlist } from "@/lib/catalysts/playbook";
import {
  CATEGORY_LABELS,
  type EventCategoryKey,
} from "@/lib/catalysts/taxonomy";
import { WATCHLIST_BUILDER_ANCHOR } from "@/lib/watchlist/draft-handoff";
import { parsePortfolioSymbols } from "@/lib/watchlist/parse-portfolio-symbols";
import {
  notifyWatchlistChanged,
  subscribeWatchlistChanged,
} from "@/lib/watchlist/watchlist-events";
import { cn } from "@/lib/utils";
import {
  scrubEnvNamesFromMessage,
  toUserFacingMessage,
} from "@/lib/errors/user-facing";

interface SavedWatchlist {
  id: number;
  name: string;
  criteria: WatchlistCriteria;
}

function criteriaSummary(criteria: WatchlistCriteria): string {
  const parts: string[] = [];
  if (criteria.symbols?.length) parts.push(criteria.symbols.join(", "));
  if (criteria.categories?.length) {
    parts.push(
      criteria.categories
        .map((c) => CATEGORY_LABELS[c as EventCategoryKey] ?? c)
        .join(", "),
    );
  }
  if (criteria.forms?.length) parts.push(criteria.forms.join(", "));
  if (criteria.tags?.length) parts.push(criteria.tags.join(", "));
  if (criteria.sources?.length) parts.push(criteria.sources.join(", "));
  if (criteria.q) parts.push(`"${criteria.q}"`);
  return parts.length > 0 ? parts.join(" · ") : "No filters";
}

/**
 * Quiet mode's "My symbols" flat list, plus which saved watchlists (rules)
 * count as additional signal sources. A watchlist is no longer just one
 * flat list — quiet mode ORs across every selected source (see
 * `matchesQuietPlaybook`).
 */
export function WatchlistPlaybookPanel() {
  const [symbols, setSymbols] = useState<{ id: number; symbol: string }[]>([]);
  const [legacyCategories, setLegacyCategories] = useState<EventCategoryKey[]>(
    [],
  );
  const [savedWatchlists, setSavedWatchlists] = useState<SavedWatchlist[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [signalWatchlists, setSignalWatchlists] = useState<
    QuietSignalWatchlist[]
  >([]);
  const [quietMode, setQuietMode] = useState(false);
  const [draft, setDraft] = useState("");
  const [portfolioDraft, setPortfolioDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [nyseBySymbol, setNyseBySymbol] = useState<
    Record<string, { lastPrice: string | null; description: string | null }>
  >({});
  const [nyseNote, setNyseNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    try {
      const [wRes, pRes, listRes, nRes] = await Promise.all([
        fetch("/api/watchlist", {
          credentials: "same-origin",
          cache: "no-store",
        }),
        fetch("/api/playbook", {
          credentials: "same-origin",
          cache: "no-store",
        }),
        fetch("/api/watchlists", {
          credentials: "same-origin",
          cache: "no-store",
        }),
        fetch("/api/nyse/symbols?limit=80", {
          credentials: "same-origin",
          cache: "no-store",
        }),
      ]);
      if (!wRes.ok || !pRes.ok) {
        throw new Error("Could not load watchlist / playbook.");
      }
      const wData = await wRes.json();
      const pData = await pRes.json();
      setSymbols(wData.symbols ?? []);
      setLegacyCategories(
        Array.isArray(pData.categories) ? pData.categories : [],
      );
      setSelectedIds(
        Array.isArray(pData.watchlistIds) ? pData.watchlistIds : [],
      );
      setSignalWatchlists(
        Array.isArray(pData.signalWatchlists) ? pData.signalWatchlists : [],
      );
      setQuietMode(Boolean(pData.quietMode));

      if (listRes.ok) {
        const listData = await listRes.json();
        setSavedWatchlists(listData.watchlists ?? []);
      }

      if (nRes.ok) {
        const nData = await nRes.json();
        const map: Record<
          string,
          { lastPrice: string | null; description: string | null }
        > = {};
        for (const row of nData.symbols ?? []) {
          if (row?.symbol) {
            map[String(row.symbol).toUpperCase()] = {
              lastPrice: row.lastPrice ?? null,
              description: row.description ?? null,
            };
          }
        }
        setNyseBySymbol(map);
        setNyseNote(
          nData.emptyReason
            ? scrubEnvNamesFromMessage(String(nData.emptyReason))
            : nData.total
              ? `${nData.total.toLocaleString()} NYSE listings loaded`
              : null,
        );
      } else {
        setNyseNote(null);
      }
    } catch (err) {
      toast.error(toUserFacingMessage(err, "Load failed."));
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    // Defer so the initial fetch's setState is not synchronous in the effect body
    // (react-hooks/set-state-in-effect).
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  useEffect(() => subscribeWatchlistChanged(() => void load()), [load]);

  async function addSymbol(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const symbol = draft.trim().toUpperCase();
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add symbol.");
      setDraft("");
      await load();
      notifyWatchlistChanged();
      toast.success(`${symbol} added to watchlist`);
    } catch (err) {
      toast.error(toUserFacingMessage(err, "Could not add symbol."));
    } finally {
      setSaving(false);
    }
  }

  async function importPortfolio(raw: string, { enableQuiet = true } = {}) {
    const { symbols: parsed } = parsePortfolioSymbols(raw, 100);
    if (parsed.length === 0) {
      toast.error("No valid symbols found in that paste / file.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: parsed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed.");
      setPortfolioDraft("");
      await load();
      notifyWatchlistChanged();
      toast.success(
        `Imported ${data.added ?? 0} symbol${(data.added ?? 0) === 1 ? "" : "s"}${
          data.skipped ? ` · ${data.skipped} already on list` : ""
        }`,
      );
      if (enableQuiet && !quietMode) {
        await savePlaybook({ quietMode: true }, { notify: true });
      }
    } catch (err) {
      toast.error(toUserFacingMessage(err, "Import failed."));
    } finally {
      setSaving(false);
    }
  }

  async function onPortfolioSubmit(e: React.FormEvent) {
    e.preventDefault();
    await importPortfolio(portfolioDraft);
  }

  async function onPortfolioFile(file: File | null) {
    if (!file) return;
    const text = await file.text();
    await importPortfolio(text);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function removeSymbol(symbol: string) {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/watchlist?symbol=${encodeURIComponent(symbol)}`,
        { method: "DELETE", credentials: "same-origin" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not remove symbol.");
      await load();
      notifyWatchlistChanged();
      toast.success(`${symbol} removed from watchlist`);
    } catch (err) {
      toast.error(toUserFacingMessage(err, "Could not remove symbol."));
    } finally {
      setSaving(false);
    }
  }

  async function savePlaybook(
    patch: { watchlistIds?: number[]; quietMode?: boolean },
    { notify = false }: { notify?: boolean } = {},
  ) {
    const nextIds = patch.watchlistIds ?? selectedIds;
    const nextQuiet = patch.quietMode ?? quietMode;
    setSaving(true);
    setSelectedIds(nextIds);
    setQuietMode(nextQuiet);
    try {
      const res = await fetch("/api/playbook", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watchlistIds: nextIds, quietMode: nextQuiet }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save playbook.");
      setSelectedIds(data.watchlistIds ?? nextIds);
      setSignalWatchlists(data.signalWatchlists ?? []);
      if (notify) {
        toast.success(
          nextQuiet ? "Quiet mode turned on" : "Quiet mode turned off",
        );
      }
    } catch (err) {
      toast.error(toUserFacingMessage(err, "Could not save playbook."));
      await load();
    } finally {
      setSaving(false);
    }
  }

  function toggleWatchlist(id: number) {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    void savePlaybook({ watchlistIds: next });
  }

  async function migrateLegacyCategories() {
    if (legacyCategories.length === 0) return;
    setMigrating(true);
    try {
      const res = await fetch("/api/watchlists", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Migrated playbook",
          criteria: { categories: legacyCategories },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not migrate.");
      notifyWatchlistChanged();
      await load();
      await savePlaybook({ watchlistIds: [...selectedIds, data.id] });
      toast.success('Created "Migrated playbook" and added it as a signal.');
    } catch (err) {
      toast.error(toUserFacingMessage(err, "Could not migrate categories."));
    } finally {
      setMigrating(false);
    }
  }

  if (!loaded) {
    return (
      <div className="flex flex-col gap-8">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={3} />
      </div>
    );
  }

  const signalCount = signalWatchlists.length;

  return (
    <div className="flex flex-col gap-8">
      <section className="overflow-hidden rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)]">
        <div className="border-b border-[var(--desk-border)] px-4 py-4 sm:px-5">
          <h2 className="text-sm font-semibold text-[var(--desk-text)]">
            My symbols
          </h2>
          <p className="mt-1 text-sm text-[var(--desk-text-muted)]">
            Always counts as a quiet-mode signal source, alongside any
            watchlists you select below.
          </p>
        </div>
        <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
          <form
            onSubmit={addSymbol}
            className="flex flex-wrap items-center gap-2"
          >
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add symbol…"
              aria-label="Add symbol"
              className="h-9 w-36 border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] font-mono text-xs uppercase"
            />
            <Button
              type="submit"
              disabled={saving || !draft.trim()}
              className="btn-press h-9 gap-1.5 bg-[var(--desk-live)] text-[#121212] hover:brightness-110"
            >
              <Plus className="size-3.5" />
              Add
            </Button>
          </form>

          <form
            onSubmit={onPortfolioSubmit}
            className="flex flex-col gap-2 rounded-lg border border-dashed border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] p-3"
          >
            <p className="text-sm font-medium text-[var(--desk-text)]">
              Import portfolio
            </p>
            <p className="text-xs text-[var(--desk-text-muted)]">
              Paste tickers or upload a CSV (first column = symbol). Focuses the
              Live tape via Quiet mode — no broker sync.
            </p>
            <textarea
              value={portfolioDraft}
              onChange={(e) => setPortfolioDraft(e.target.value)}
              placeholder={"AAPL\nMSFT, NVDA\nGOOGL"}
              rows={3}
              aria-label="Paste portfolio symbols"
              className="w-full resize-y rounded-md border border-[var(--desk-border-strong)] bg-[var(--desk-panel)] px-2.5 py-2 font-mono text-xs text-[var(--desk-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--desk-link)]/40"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="submit"
                disabled={saving || !portfolioDraft.trim()}
                variant="outline"
                className="btn-press h-9 border-[var(--desk-border-strong)]"
              >
                Import paste
              </Button>
              <Button
                type="button"
                disabled={saving}
                variant="outline"
                className="btn-press h-9 gap-1.5 border-[var(--desk-border-strong)]"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="size-3.5" />
                Upload CSV
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                className="hidden"
                onChange={(e) =>
                  void onPortfolioFile(e.target.files?.[0] ?? null)
                }
              />
            </div>
          </form>

          {nyseNote ? (
            <p className="font-mono text-[0.7rem] text-[var(--desk-text-dim)]">
              {nyseNote}
            </p>
          ) : null}
          {symbols.length === 0 ? (
            <p className="font-mono text-xs text-[var(--desk-text-dim)]">
              No symbols yet — quiet mode will rely on your selected watchlists
              below.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {symbols.map((t) => {
                const nyse = nyseBySymbol[t.symbol.toUpperCase()];
                return (
                  <li
                    key={t.id}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-2.5 py-1 font-mono text-sm text-[var(--desk-text)]"
                    title={nyse?.description ?? undefined}
                  >
                    {t.symbol}
                    {nyse?.lastPrice ? (
                      <span className="text-[0.7rem] text-[var(--desk-text-dim)] tabular-nums">
                        ${nyse.lastPrice}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      aria-label={`Remove ${t.symbol}`}
                      disabled={saving}
                      onClick={() => void removeSymbol(t.symbol)}
                      className="text-[var(--desk-text-muted)] hover:text-[var(--desk-text)]"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)]">
        <div className="border-b border-[var(--desk-border)] px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--desk-text)]">
                Signal watchlists
              </h2>
              <p className="mt-1 text-sm text-[var(--desk-text-muted)]">
                Pick any saved watchlists (rules) that should also count as
                signal when quiet mode is on — not just one flat list.
                {signalCount > 0
                  ? ` ${signalCount} selected.`
                  : " None selected yet."}
              </p>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                void savePlaybook({ quietMode: !quietMode }, { notify: true })
              }
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[0.82rem] font-medium transition-colors",
                quietMode
                  ? "border-[var(--desk-live)]/45 bg-[var(--desk-live)]/10 text-[var(--desk-live)]"
                  : "border-[var(--desk-border-strong)] text-[var(--desk-text-secondary)]",
              )}
            >
              Quiet mode {quietMode ? "on" : "off"}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
          {savedWatchlists.length === 0 ? (
            <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-3 py-3">
              <p className="text-sm text-[var(--desk-text-muted)]">
                No saved watchlists yet — build one below (template, AI, or by
                hand) to use as a quiet-mode signal.
              </p>
              <Link
                href={`#${WATCHLIST_BUILDER_ANCHOR}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--desk-live)] hover:underline"
              >
                Build a watchlist
                <ArrowRight className="size-3" />
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {savedWatchlists.map((w) => {
                const active = selectedIds.includes(w.id);
                return (
                  <li key={w.id}>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => toggleWatchlist(w.id)}
                      aria-pressed={active}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                        active
                          ? "border-[var(--desk-live)]/45 bg-[var(--desk-live)]/10"
                          : "border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] hover:bg-[var(--desk-overlay-strong)]",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "mt-0.5 grid size-4 shrink-0 place-items-center rounded-sm border text-[0.6rem]",
                          active
                            ? "border-[var(--desk-live)] bg-[var(--desk-live)] text-[#121212]"
                            : "border-[var(--desk-border-strong)]",
                        )}
                      >
                        {active ? "✓" : ""}
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

          {legacyCategories.length > 0 ? (
            <button
              type="button"
              disabled={migrating}
              onClick={() => void migrateLegacyCategories()}
              className="inline-flex items-center gap-1.5 self-start rounded-md border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-2.5 py-1.5 font-mono text-[0.7rem] text-[var(--desk-text-secondary)] transition-colors hover:bg-[var(--desk-overlay-strong)] hover:text-[var(--desk-text)]"
            >
              <Sparkles className="size-3" />
              {migrating
                ? "Migrating…"
                : "Turn my old playbook categories into a watchlist"}
            </button>
          ) : null}

          <p className="text-xs text-[var(--desk-text-dim)]">
            Nothing selected? Quiet mode falls back to a sane default event-type
            filter until you pick a symbol or watchlist.
          </p>
        </div>
      </section>
    </div>
  );
}
