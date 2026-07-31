"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SkeletonCard } from "@/components/loading-skeleton";
import {
  CATEGORY_LABELS,
  type EventCategoryKey,
} from "@/lib/jobs/parse-8k-items";
import { DEFAULT_PLAYBOOK_CATEGORIES } from "@/lib/catalysts/playbook";
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

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as EventCategoryKey[];

export function WatchlistPlaybookPanel() {
  const [symbols, setSymbols] = useState<{ id: number; symbol: string }[]>([]);
  const [categories, setCategories] = useState<EventCategoryKey[]>(
    DEFAULT_PLAYBOOK_CATEGORIES,
  );
  const [quietMode, setQuietMode] = useState(false);
  const [draft, setDraft] = useState("");
  const [portfolioDraft, setPortfolioDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [nyseBySymbol, setNyseBySymbol] = useState<
    Record<string, { lastPrice: string | null; description: string | null }>
  >({});
  const [nyseNote, setNyseNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    try {
      const [wRes, pRes, nRes] = await Promise.all([
        fetch("/api/watchlist", {
          credentials: "same-origin",
          cache: "no-store",
        }),
        fetch("/api/playbook", {
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
      setCategories(
        Array.isArray(pData.categories) && pData.categories.length > 0
          ? pData.categories
          : DEFAULT_PLAYBOOK_CATEGORIES,
      );
      setQuietMode(Boolean(pData.quietMode));

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
        await savePlaybook(categories, true, { notify: true });
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
    nextCategories: EventCategoryKey[],
    nextQuiet: boolean,
    { notify = false }: { notify?: boolean } = {},
  ) {
    setSaving(true);
    setCategories(nextCategories);
    setQuietMode(nextQuiet);
    try {
      const res = await fetch("/api/playbook", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categories: nextCategories,
          quietMode: nextQuiet,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save playbook.");
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

  function toggleCategory(cat: EventCategoryKey) {
    const next = categories.includes(cat)
      ? categories.filter((c) => c !== cat)
      : [...categories, cat];
    void savePlaybook(next, quietMode);
  }

  if (!loaded) {
    return (
      <div className="flex flex-col gap-8">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={3} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="overflow-hidden rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)]">
        <div className="border-b border-[var(--desk-border)] px-4 py-4 sm:px-5">
          <h2 className="text-sm font-semibold text-[var(--desk-text)]">
            Watchlist symbols
          </h2>
          <p className="mt-1 text-sm text-[var(--desk-text-muted)]">
            When Quiet playbook is on, the Live feed only shows these names
            (plus playbook categories below).
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
              Live tape via Quiet playbook — no broker sync.
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
              No symbols yet — quiet mode will filter by playbook categories
              only.
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
                Playbook categories
              </h2>
              <p className="mt-1 text-sm text-[var(--desk-text-muted)]">
                Signal types that survive quiet-mode noise filtering.
              </p>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                void savePlaybook(categories, !quietMode, { notify: true })
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
        <div className="flex flex-wrap gap-1.5 px-4 py-4 sm:px-5">
          {ALL_CATEGORIES.map((cat) => {
            const active = categories.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                disabled={saving}
                onClick={() => toggleCategory(cat)}
                className={cn(
                  "inline-flex h-8 items-center rounded-md border px-2.5 font-mono text-[0.7rem] tracking-wide transition-colors",
                  active
                    ? "border-[var(--desk-text-dim)] bg-[var(--desk-overlay-strong)] text-[var(--desk-text)]"
                    : "border-[var(--desk-border)] text-[var(--desk-text-muted)] hover:border-[var(--desk-border-strong)]",
                )}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
