"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [wRes, pRes] = await Promise.all([
        fetch("/api/watchlist", {
          credentials: "same-origin",
          cache: "no-store",
        }),
        fetch("/api/playbook", {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addTicker(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add ticker.");
    } finally {
      setSaving(false);
    }
  }

  async function removeTicker(ticker: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/watchlist?ticker=${encodeURIComponent(ticker)}`,
        { method: "DELETE", credentials: "same-origin" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not remove ticker.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove ticker.");
    } finally {
      setSaving(false);
    }
  }

  async function savePlaybook(
    nextCategories: EventCategoryKey[],
    nextQuiet: boolean,
  ) {
    setSaving(true);
    setError(null);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save playbook.");
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
      <p className="font-mono text-sm text-[var(--desk-text-muted)]">
        Loading…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {error ? (
        <p className="font-mono text-sm text-destructive">{error}</p>
      ) : null}

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
              className="h-9 w-36 border-[var(--desk-border-strong)] bg-white/[0.02] font-mono text-xs uppercase"
            />
            <Button
              type="submit"
              disabled={saving || !draft.trim()}
              className="btn-press h-9 gap-1.5 bg-amber-500 text-zinc-950 hover:bg-amber-400"
            >
              <Plus className="size-3.5" />
              Add
            </Button>
          </form>
          {tickers.length === 0 ? (
            <p className="font-mono text-xs text-[var(--desk-text-dim)]">
              No tickers yet — quiet mode will filter by playbook categories
              only.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {tickers.map((t) => (
                <li
                  key={t.id}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--desk-border-strong)] bg-white/[0.03] px-2.5 py-1 font-mono text-sm text-[var(--desk-text)]"
                >
                  {t.ticker}
                  <button
                    type="button"
                    aria-label={`Remove ${t.ticker}`}
                    disabled={saving}
                    onClick={() => void removeTicker(t.ticker)}
                    className="text-[var(--desk-text-muted)] hover:text-red-300"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
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
              onClick={() => void savePlaybook(categories, !quietMode)}
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
                    ? "border-[var(--desk-accent)]/55 bg-[var(--desk-accent)]/12 text-[var(--desk-accent-fg)]"
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
