"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SkeletonCard } from "@/components/loading-skeleton";
import {
  CATEGORY_LABELS,
  type EventCategoryKey,
} from "@/lib/jobs/parse-8k-items";
import { DEFAULT_PLAYBOOK_CATEGORIES } from "@/lib/catalysts/playbook";
import { cn } from "@/lib/utils";

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as EventCategoryKey[];

export function WatchlistPlaybookPanel() {
  const [tickers, setTickers] = useState<{ id: number; ticker: string }[]>([]);
  const [categories, setCategories] = useState<EventCategoryKey[]>(
    DEFAULT_PLAYBOOK_CATEGORIES,
  );
  const [quietMode, setQuietMode] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [nyseBySymbol, setNyseBySymbol] = useState<
    Record<string, { lastPrice: string | null; description: string | null }>
  >({});
  const [nyseNote, setNyseNote] = useState<string | null>(null);

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
      setTickers(wData.tickers ?? []);
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
            ? String(nData.emptyReason)
            : nData.total
              ? `${nData.total.toLocaleString()} NYSE listings loaded`
              : null,
        );
      } else {
        setNyseNote(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Load failed.");
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

  async function addTicker(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const ticker = draft.trim().toUpperCase();
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add ticker.");
      setDraft("");
      await load();
      toast.success(`${ticker} added to watchlist`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add ticker.");
    } finally {
      setSaving(false);
    }
  }

  async function removeTicker(ticker: string) {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/watchlist?ticker=${encodeURIComponent(ticker)}`,
        { method: "DELETE", credentials: "same-origin" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not remove ticker.");
      await load();
      toast.success(`${ticker} removed from watchlist`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not remove ticker.",
      );
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
      toast.error(
        err instanceof Error ? err.message : "Could not save playbook.",
      );
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
            Watchlist tickers
          </h2>
          <p className="mt-1 text-sm text-[var(--desk-text-muted)]">
            When Quiet playbook is on, the Live feed only shows these names
            (plus playbook categories below).
          </p>
        </div>
        <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
          <form
            onSubmit={addTicker}
            className="flex flex-wrap items-center gap-2"
          >
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add ticker…"
              aria-label="Add ticker"
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
          {nyseNote ? (
            <p className="font-mono text-[0.7rem] text-[var(--desk-text-dim)]">
              {nyseNote}
            </p>
          ) : null}
          {tickers.length === 0 ? (
            <p className="font-mono text-xs text-[var(--desk-text-dim)]">
              No tickers yet — quiet mode will filter by playbook categories
              only.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {tickers.map((t) => {
                const nyse = nyseBySymbol[t.ticker.toUpperCase()];
                return (
                  <li
                    key={t.id}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-2.5 py-1 font-mono text-sm text-[var(--desk-text)]"
                    title={nyse?.description ?? undefined}
                  >
                    {t.ticker}
                    {nyse?.lastPrice ? (
                      <span className="text-[0.7rem] text-[var(--desk-text-dim)] tabular-nums">
                        ${nyse.lastPrice}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      aria-label={`Remove ${t.ticker}`}
                      disabled={saving}
                      onClick={() => void removeTicker(t.ticker)}
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
