"use client";

import { useCallback, useEffect, useState } from "react";
import { BellOff, ListFilter, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { SkeletonCard } from "@/components/loading-skeleton";
import { Button } from "@/components/ui/button";
import {
  WatchlistCard,
  type SavedWatchlist,
} from "@/components/watchlists/watchlist-card";
import {
  WatchlistEditorDialog,
  type WatchlistDraft,
} from "@/components/watchlists/watchlist-editor-dialog";
import { QuietModePanel } from "@/components/watchlists/quiet-mode-panel";
import { toUserFacingMessage } from "@/lib/errors/user-facing";
import {
  WATCHLIST_DRAFT_HANDOFF_KEY,
  type WatchlistDraftHandoff,
} from "@/lib/watchlist/draft-handoff";
import {
  WATCHLIST_STARTER_PACK_IDS,
  WATCHLIST_TEMPLATES,
  watchlistTemplateById,
} from "@/lib/watchlist/templates";
import {
  notifyWatchlistChanged,
  subscribeWatchlistChanged,
} from "@/lib/watchlist/watchlist-events";
import { cn } from "@/lib/utils";

type Tab = "watchlists" | "quiet";

/**
 * `/watchlist` shell. Two jobs, deliberately split into tabs so neither
 * crowds the other: the **watchlist library** (create / scan / apply rules)
 * and **quiet mode** (which of those rules, plus your symbols, survive a
 * noisy tape).
 */
export function WatchlistHub() {
  const [tab, setTab] = useState<Tab>("watchlists");
  const [watchlists, setWatchlists] = useState<SavedWatchlist[]>([]);
  const [symbols, setSymbols] = useState<{ id: number; symbol: string }[]>([]);
  const [quietMode, setQuietMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [legacyCategories, setLegacyCategories] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorDraft, setEditorDraft] = useState<WatchlistDraft | null>(null);

  const load = useCallback(async () => {
    try {
      const [listRes, playbookRes, symbolsRes] = await Promise.all([
        fetch("/api/watchlists", {
          credentials: "same-origin",
          cache: "no-store",
        }),
        fetch("/api/playbook", {
          credentials: "same-origin",
          cache: "no-store",
        }),
        fetch("/api/watchlist", {
          credentials: "same-origin",
          cache: "no-store",
        }),
      ]);
      if (listRes.ok) {
        const data = await listRes.json();
        setWatchlists(data.watchlists ?? []);
      }
      if (playbookRes.ok) {
        const data = await playbookRes.json();
        setQuietMode(Boolean(data.quietMode));
        setSelectedIds(
          Array.isArray(data.watchlistIds) ? data.watchlistIds : [],
        );
        setLegacyCategories(
          Array.isArray(data.categories) ? data.categories : [],
        );
      }
      if (symbolsRes.ok) {
        const data = await symbolsRes.json();
        setSymbols(data.symbols ?? []);
      }
    } catch (err) {
      toast.error(toUserFacingMessage(err, "Could not load watchlists."));
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  useEffect(() => subscribeWatchlistChanged(() => void load()), [load]);

  // One-shot handoff from the tape's "open the builder" link — opens the
  // editor prefilled with the feed's current filters, unsaved.
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const raw = window.sessionStorage.getItem(WATCHLIST_DRAFT_HANDOFF_KEY);
        if (!raw) return;
        window.sessionStorage.removeItem(WATCHLIST_DRAFT_HANDOFF_KEY);
        const parsed = JSON.parse(raw) as WatchlistDraftHandoff;
        setEditorDraft({
          id: null,
          name: parsed.name ?? "",
          criteria: parsed.criteria ?? {},
        });
        setTab("watchlists");
        setEditorOpen(true);
      } catch {
        // Ignore malformed payloads — the page just loads normally.
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  async function savePlaybook(patch: {
    watchlistIds?: number[];
    quietMode?: boolean;
  }) {
    const nextIds = patch.watchlistIds ?? selectedIds;
    const nextQuiet = patch.quietMode ?? quietMode;
    setBusy(true);
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
      if (!res.ok) throw new Error(data.error ?? "Could not save quiet mode.");
      setSelectedIds(data.watchlistIds ?? nextIds);
    } catch (err) {
      toast.error(toUserFacingMessage(err, "Could not save quiet mode."));
      await load();
    } finally {
      setBusy(false);
    }
  }

  function openCreate(prefill?: WatchlistDraft) {
    setEditorDraft(prefill ?? null);
    setEditorOpen(true);
  }

  async function addFromTemplates(options: {
    templateId?: string;
    starterPack?: boolean;
  }) {
    setBusy(true);
    try {
      const res = await fetch("/api/watchlists/templates", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          options.starterPack
            ? { starterPack: true }
            : { templateId: options.templateId },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add watchlist.");
      const created = Array.isArray(data.created) ? data.created : [];
      notifyWatchlistChanged();
      await load();
      if (created.length === 0) {
        toast.message("Already have those watchlists.");
      } else if (created.length === 1) {
        toast.success(`Added “${created[0].name}”`);
      } else {
        toast.success(`Added ${created.length} watchlists`);
      }
    } catch (err) {
      toast.error(toUserFacingMessage(err, "Could not add watchlist."));
    } finally {
      setBusy(false);
    }
  }

  async function deleteWatchlist(w: SavedWatchlist) {
    setBusy(true);
    try {
      const res = await fetch(`/api/watchlists/${w.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not delete.");
      setWatchlists((prev) => prev.filter((x) => x.id !== w.id));
      setSelectedIds((prev) => prev.filter((id) => id !== w.id));
      notifyWatchlistChanged();
      toast.success(`Deleted “${w.name}”`);
    } catch (err) {
      toast.error(toUserFacingMessage(err, "Could not delete watchlist."));
    } finally {
      setBusy(false);
    }
  }

  async function addSymbol(symbol: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add symbol.");
      await load();
      notifyWatchlistChanged();
      toast.success(`${symbol} added`);
    } catch (err) {
      toast.error(toUserFacingMessage(err, "Could not add symbol."));
    } finally {
      setBusy(false);
    }
  }

  async function removeSymbol(symbol: string) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/watchlist?symbol=${encodeURIComponent(symbol)}`,
        { method: "DELETE", credentials: "same-origin" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not remove symbol.");
      await load();
      notifyWatchlistChanged();
    } catch (err) {
      toast.error(toUserFacingMessage(err, "Could not remove symbol."));
    } finally {
      setBusy(false);
    }
  }

  async function migrateLegacyCategories() {
    if (legacyCategories.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/watchlists", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "My playbook",
          criteria: { categories: legacyCategories },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not convert.");
      notifyWatchlistChanged();
      await load();
      await savePlaybook({ watchlistIds: [...selectedIds, data.id] });
      toast.success("Created “My playbook” and switched it on as signal.");
    } catch (err) {
      toast.error(toUserFacingMessage(err, "Could not convert categories."));
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) {
    return (
      <div className="flex flex-col gap-4">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={4} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Watchlist sections"
        className="inline-flex w-fit items-center gap-1 rounded-lg border border-[var(--desk-border)] bg-[var(--desk-overlay-soft)] p-1"
      >
        <TabButton
          active={tab === "watchlists"}
          onClick={() => setTab("watchlists")}
          icon={<ListFilter className="size-3.5" />}
          label="Watchlists"
          badge={watchlists.length > 0 ? String(watchlists.length) : undefined}
        />
        <TabButton
          active={tab === "quiet"}
          onClick={() => setTab("quiet")}
          icon={<BellOff className="size-3.5" />}
          label="Quiet mode"
          badge={quietMode ? "on" : undefined}
        />
      </div>

      {tab === "watchlists" ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--desk-text-secondary)]">
              {watchlists.length === 0
                ? "Save the filters you keep re-typing as a reusable rule."
                : `${watchlists.length} watchlist${watchlists.length === 1 ? "" : "s"} · open one on the tape or switch it on as quiet-mode signal.`}
            </p>
            <Button
              type="button"
              onClick={() => openCreate()}
              className="btn-press gap-1.5 bg-[var(--desk-live)] text-[#121212] hover:brightness-110"
            >
              <Plus className="size-3.5" />
              New watchlist
            </Button>
          </div>

          {watchlists.length === 0 ? (
            <section className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-[var(--desk-border-strong)] bg-[var(--desk-panel)] px-6 py-10 text-center">
              <span className="grid size-12 place-items-center rounded-xl border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] text-[var(--desk-live)]">
                <ListFilter className="size-5" aria-hidden />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-[var(--desk-text)]">
                  No watchlists yet
                </h2>
                <p className="mx-auto mt-1 max-w-md text-sm text-[var(--desk-text-muted)]">
                  One tap adds a ready-made rule. Or grab the starter pack and
                  refine later.
                </p>
              </div>
              <Button
                type="button"
                disabled={busy}
                onClick={() => void addFromTemplates({ starterPack: true })}
                className="btn-press gap-1.5 bg-[var(--desk-live)] text-[#121212] hover:brightness-110"
              >
                <Plus className="size-3.5" aria-hidden />
                Add starter pack ({WATCHLIST_STARTER_PACK_IDS.length})
              </Button>
              <div className="flex flex-wrap justify-center gap-2">
                {WATCHLIST_STARTER_PACK_IDS.map((id) => {
                  const template = watchlistTemplateById(id);
                  if (!template) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={busy}
                      onClick={() => void addFromTemplates({ templateId: id })}
                      className="rounded-full border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-3 py-1.5 text-xs font-medium text-[var(--desk-text-secondary)] transition-colors hover:border-[var(--desk-live)]/50 hover:text-[var(--desk-text)] disabled:opacity-50"
                    >
                      + {template.name}
                    </button>
                  );
                })}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => openCreate()}
                className="gap-1.5 border-[var(--desk-border-strong)]"
              >
                <Sparkles className="size-3.5" />
                Or describe it to AI
              </Button>
            </section>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {WATCHLIST_TEMPLATES.slice(0, 6).map((template) => {
                  const already = watchlists.some(
                    (w) =>
                      w.name.trim().toLowerCase() ===
                      template.name.trim().toLowerCase(),
                  );
                  return (
                    <button
                      key={template.id}
                      type="button"
                      disabled={busy || already}
                      onClick={() =>
                        void addFromTemplates({ templateId: template.id })
                      }
                      className="rounded-full border border-[var(--desk-border)] bg-[var(--desk-overlay-soft)] px-2.5 py-1 text-[0.7rem] text-[var(--desk-text-muted)] transition-colors hover:border-[var(--desk-live)]/40 hover:text-[var(--desk-text)] disabled:opacity-40"
                      title={
                        already
                          ? "Already in your library"
                          : template.description
                      }
                    >
                      {already ? "✓ " : "+ "}
                      {template.name}
                    </button>
                  );
                })}
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {watchlists.map((w) => (
                  <WatchlistCard
                    key={w.id}
                    watchlist={w}
                    isQuietSignal={selectedIds.includes(w.id)}
                    busy={busy}
                    onToggleQuiet={() =>
                      void savePlaybook({
                        watchlistIds: selectedIds.includes(w.id)
                          ? selectedIds.filter((id) => id !== w.id)
                          : [...selectedIds, w.id],
                      })
                    }
                    onEdit={() =>
                      openCreate({
                        id: w.id,
                        name: w.name,
                        criteria: w.criteria,
                      })
                    }
                    onDelete={() => void deleteWatchlist(w)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <QuietModePanel
          quietMode={quietMode}
          symbols={symbols}
          watchlists={watchlists}
          selectedIds={selectedIds}
          legacyCategoryCount={legacyCategories.length}
          busy={busy}
          onToggleQuiet={() => void savePlaybook({ quietMode: !quietMode })}
          onAddSymbol={addSymbol}
          onRemoveSymbol={removeSymbol}
          onToggleWatchlist={(id) =>
            void savePlaybook({
              watchlistIds: selectedIds.includes(id)
                ? selectedIds.filter((x) => x !== id)
                : [...selectedIds, id],
            })
          }
          onMigrateLegacy={migrateLegacyCategories}
          onGoToWatchlists={() => {
            setTab("watchlists");
            openCreate();
          }}
        />
      )}

      <WatchlistEditorDialog
        open={editorOpen}
        draft={editorDraft}
        onOpenChange={(next) => {
          setEditorOpen(next);
          if (!next) setEditorDraft(null);
        }}
        onSaved={async () => {
          notifyWatchlistChanged();
          await load();
        }}
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[0.82rem] font-medium transition-colors",
        active
          ? "bg-[var(--desk-panel)] text-[var(--desk-text)] shadow-[inset_0_0_0_1px_var(--desk-border-strong)]"
          : "text-[var(--desk-text-muted)] hover:text-[var(--desk-text)]",
      )}
    >
      {icon}
      {label}
      {badge ? (
        <span className="rounded-full bg-[var(--desk-live)]/15 px-1.5 font-mono text-[0.65rem] text-[var(--desk-live)]">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
