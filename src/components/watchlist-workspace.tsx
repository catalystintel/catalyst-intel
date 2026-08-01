"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  ChevronDown,
  Eye,
  ListFilter,
  Loader2,
  Pencil,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { FeedFilterMultiSelect } from "@/components/feed-filter-multi-select";
import { SkeletonCard } from "@/components/loading-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WatchlistCriteria } from "@/db/schema";
import type { FeedCatalyst } from "@/lib/catalysts/feed-catalyst";
import {
  FEED_FORM_FILTERS,
  FEED_FORM_LABELS,
} from "@/lib/catalysts/feed-form-filters";
import { titleLine } from "@/lib/catalysts/feed-display";
import { CATEGORY_LABELS, isEventCategoryKey } from "@/lib/catalysts/taxonomy";
import { toUserFacingMessage } from "@/lib/errors/user-facing";
import { isLocalDevUi } from "@/lib/dev/local-dev-ui";
import { feedHref } from "@/lib/nav/feed-href";
import {
  WATCHLIST_DRAFT_HANDOFF_KEY,
  type WatchlistDraftHandoff,
} from "@/lib/watchlist/draft-handoff";
import { WATCHLIST_TEMPLATES } from "@/lib/watchlist/templates";
import { cn } from "@/lib/utils";

interface SavedWatchlist {
  id: number;
  name: string;
  criteria: WatchlistCriteria;
  createdAt: string;
  updatedAt: string;
}

interface DraftFields {
  name: string;
  symbolsText: string;
  categories: string[];
  forms: string[];
  tagsText: string;
  sourcesText: string;
  q: string;
}

const EMPTY_DRAFT: DraftFields = {
  name: "",
  symbolsText: "",
  categories: [],
  forms: [],
  tagsText: "",
  sourcesText: "",
  q: "",
};

const QUICK_TAGS = [
  "impact:high",
  "impact:medium",
  "session:ah",
  "session:pm",
  "sentiment:bullish",
  "sentiment:bearish",
  "fda",
  "ma",
  "ipo",
];

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(
  ([value, label]) => ({ value, label }),
);
const FORM_OPTIONS = FEED_FORM_FILTERS.map((value) => ({
  value,
  label: FEED_FORM_LABELS[value],
}));

function parseCsv(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function draftToCriteria(draft: DraftFields): WatchlistCriteria {
  const criteria: WatchlistCriteria = {};
  const symbols = parseCsv(draft.symbolsText).map((s) => s.toUpperCase());
  if (symbols.length > 0) criteria.symbols = symbols;
  if (draft.categories.length > 0) criteria.categories = draft.categories;
  if (draft.forms.length > 0) criteria.forms = draft.forms;
  const tags = parseCsv(draft.tagsText).map((t) => t.toLowerCase());
  if (tags.length > 0) criteria.tags = tags;
  const sources = parseCsv(draft.sourcesText).map((s) => s.toLowerCase());
  if (sources.length > 0) criteria.sources = sources;
  if (draft.q.trim()) criteria.q = draft.q.trim();
  return criteria;
}

function criteriaToDraft(
  name: string,
  criteria: WatchlistCriteria,
): DraftFields {
  return {
    name,
    symbolsText: (criteria.symbols ?? []).join(", "),
    categories: (criteria.categories ?? []).filter(isEventCategoryKey),
    forms: (criteria.forms ?? []).filter((f) =>
      (FEED_FORM_FILTERS as readonly string[]).includes(f),
    ),
    tagsText: (criteria.tags ?? []).join(", "),
    sourcesText: (criteria.sources ?? []).join(", "),
    q: criteria.q ?? "",
  };
}

/** `category:earnings` → "Category: earnings" — used for chips + quick-tag labels. */
function tagLabel(tag: string): string {
  const [ns, ...rest] = tag.split(":");
  if (rest.length === 0) return tag;
  return `${ns.charAt(0).toUpperCase()}${ns.slice(1)}: ${rest.join(":")}`;
}

function criteriaChips(criteria: WatchlistCriteria): string[] {
  const chips: string[] = [];
  for (const symbol of criteria.symbols ?? []) chips.push(symbol);
  for (const category of criteria.categories ?? [])
    chips.push(
      CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ?? category,
    );
  for (const form of criteria.forms ?? []) chips.push(form);
  for (const tag of criteria.tags ?? []) chips.push(tagLabel(tag));
  for (const source of criteria.sources ?? []) chips.push(source);
  if (criteria.q) chips.push(`"${criteria.q}"`);
  return chips;
}

type PreviewState =
  null | "loading" | { total: number; catalysts: FeedCatalyst[] };

function isCriteriaEmpty(criteria: WatchlistCriteria): boolean {
  return Object.keys(criteria).length === 0;
}

async function fetchPreview(criteria: WatchlistCriteria): Promise<{
  total: number;
  catalysts: FeedCatalyst[];
}> {
  const res = await fetch("/api/watchlists/preview", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ criteria }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Preview failed.");
  return { total: data.total ?? 0, catalysts: data.catalysts ?? [] };
}

function PreviewList({ preview }: { preview: PreviewState }) {
  if (preview === "loading") {
    return (
      <p className="flex items-center gap-1.5 font-mono text-[0.7rem] text-[var(--desk-text-dim)]">
        <Loader2 className="size-3 animate-spin" />
        Checking matches…
      </p>
    );
  }
  if (!preview) {
    return (
      <p className="font-mono text-[0.7rem] text-[var(--desk-text-dim)]">
        Add a filter to see live matches.
      </p>
    );
  }
  if (preview.catalysts.length === 0) {
    return (
      <p className="text-sm text-[var(--desk-text-muted)]">
        No matches right now ({preview.total} total in the current retention
        window).
      </p>
    );
  }
  return (
    <>
      <p className="mb-2 font-mono text-[0.68rem] text-[var(--desk-text-dim)]">
        {preview.total} match{preview.total === 1 ? "" : "es"} · showing{" "}
        {preview.catalysts.length}
      </p>
      <ul className="flex flex-col gap-1.5">
        {preview.catalysts.map((c) => (
          <li
            key={c.id}
            className="truncate font-mono text-[0.72rem] text-[var(--desk-text-secondary)]"
          >
            <span className="font-semibold text-[var(--desk-text)]">
              {c.symbol ?? "—"}
            </span>{" "}
            · {titleLine(c)}
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Watchlists as first-class "rules": explicit symbols + dynamic conditions
 * (event type, form, auto-tag) combined in one saved, previewable,
 * re-appliable filter — drafted from a template, built by hand, or written
 * in plain English via AI (which can also refine an existing draft). Next
 * phase: reference a saved rule from an alert rule's conditions.
 */
export function WatchlistWorkspace() {
  const [watchlists, setWatchlists] = useState<SavedWatchlist[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<DraftFields>(EMPTY_DRAFT);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRationale, setAiRationale] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<PreviewState>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [listPreviews, setListPreviews] = useState<
    Record<number, PreviewState>
  >({});
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const builderRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/watchlists", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load watchlists.");
      setWatchlists(data.watchlists ?? []);
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

  // One-shot handoff from the Catalyst Feed's "Open in watchlist builder"
  // link — prefills the draft with the tape's current filters, unsaved.
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const raw = window.sessionStorage.getItem(WATCHLIST_DRAFT_HANDOFF_KEY);
        if (!raw) return;
        window.sessionStorage.removeItem(WATCHLIST_DRAFT_HANDOFF_KEY);
        const parsed = JSON.parse(raw) as WatchlistDraftHandoff;
        setDraft(criteriaToDraft(parsed.name ?? "", parsed.criteria ?? {}));
        builderRef.current?.scrollIntoView({ behavior: "smooth" });
      } catch {
        // Ignore malformed handoff payloads — builder just starts blank.
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const criteria = useMemo(() => draftToCriteria(draft), [draft]);
  const criteriaKey = useMemo(() => JSON.stringify(criteria), [criteria]);

  useEffect(() => {
    const immediate = window.setTimeout(() => {
      if (isCriteriaEmpty(criteria)) {
        setPreview(null);
        return;
      }
      setPreview("loading");
    }, 0);
    const debounced = window.setTimeout(() => {
      if (isCriteriaEmpty(criteria)) return;
      void fetchPreview(criteria)
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 350);
    return () => {
      window.clearTimeout(immediate);
      window.clearTimeout(debounced);
    };
    // criteriaKey is the stable dep; `criteria` itself is a new object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criteriaKey]);

  function applyTemplate(templateId: string) {
    const template = WATCHLIST_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    setEditingId(null);
    setDraft(criteriaToDraft(template.name, template.criteria));
    setAiRationale(null);
  }

  function addQuickTag(tag: string) {
    setDraft((prev) => {
      const tags = parseCsv(prev.tagsText).map((t) => t.toLowerCase());
      if (tags.includes(tag)) return prev;
      return { ...prev, tagsText: [...tags, tag].join(", ") };
    });
  }

  async function runAi() {
    if (!aiPrompt.trim()) {
      toast.error("Describe the rule you want first.");
      return;
    }
    setAiLoading(true);
    try {
      const res = await fetch("/api/watchlists/ai-draft", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiPrompt,
          existingName: draft.name.trim() || undefined,
          existingCriteria: isCriteriaEmpty(criteria) ? undefined : criteria,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI drafting failed.");
      setDraft(criteriaToDraft(data.name, data.criteria));
      setAiRationale(
        typeof data.rationale === "string" ? data.rationale : null,
      );
      toast.success("Draft updated — review below, then save or refine again.");
    } catch (err) {
      toast.error(toUserFacingMessage(err, "AI drafting failed."));
    } finally {
      setAiLoading(false);
    }
  }

  async function saveDraft() {
    if (!draft.name.trim()) {
      toast.error("Name your watchlist first.");
      return;
    }
    if (isCriteriaEmpty(criteria)) {
      toast.error("Add at least one filter (symbols, tags, event type…).");
      return;
    }
    setSaving(true);
    try {
      const url = editingId
        ? `/api/watchlists/${editingId}`
        : "/api/watchlists";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draft.name.trim(), criteria }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save watchlist.");
      toast.success(
        editingId ? "Watchlist updated" : `Saved "${draft.name.trim()}"`,
      );
      setDraft(EMPTY_DRAFT);
      setEditingId(null);
      setAiPrompt("");
      setAiRationale(null);
      await load();
    } catch (err) {
      toast.error(toUserFacingMessage(err, "Could not save watchlist."));
    } finally {
      setSaving(false);
    }
  }

  function editWatchlist(w: SavedWatchlist) {
    setEditingId(w.id);
    setDraft(criteriaToDraft(w.name, w.criteria));
    setAiPrompt("");
    setAiRationale(null);
    builderRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setAiPrompt("");
    setAiRationale(null);
  }

  async function deleteWatchlist(id: number, name: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/watchlists/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not delete.");
      setWatchlists((prev) => prev.filter((w) => w.id !== id));
      if (editingId === id) cancelEdit();
      toast.success(`Deleted "${name}"`);
    } catch (err) {
      toast.error(toUserFacingMessage(err, "Could not delete watchlist."));
    } finally {
      setDeletingId(null);
    }
  }

  async function toggleListPreview(id: number) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (listPreviews[id] && listPreviews[id] !== "loading") return;
    setListPreviews((prev) => ({ ...prev, [id]: "loading" }));
    try {
      const res = await fetch(`/api/watchlists/${id}/preview`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preview failed.");
      setListPreviews((prev) => ({
        ...prev,
        [id]: { total: data.total ?? 0, catalysts: data.catalysts ?? [] },
      }));
    } catch (err) {
      toast.error(toUserFacingMessage(err, "Preview failed."));
      setListPreviews((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setExpandedId(null);
    }
  }

  if (!loaded) {
    return (
      <div className="flex flex-col gap-4">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={3} />
      </div>
    );
  }

  const draftChips = criteriaChips(criteria);

  return (
    <div className="flex flex-col gap-6">
      {/* Builder */}
      <section
        ref={builderRef}
        className="overflow-hidden rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)]"
      >
        <div className="border-b border-[var(--desk-border)] px-4 py-4 sm:px-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--desk-text)]">
            {editingId ? (
              <>
                <Pencil className="size-3.5 text-[var(--desk-live)]" />
                Editing watchlist
              </>
            ) : (
              "Build a watchlist"
            )}
          </h2>
          <p className="mt-1 text-sm text-[var(--desk-text-muted)]">
            A watchlist is a rule: explicit symbols, dynamic conditions (event
            type, form, tag), or both — combined and previewed live against the
            tape. Start from a template, describe it to AI, or build it by hand
            below.
          </p>
        </div>

        {/* Templates */}
        <div className="border-b border-[var(--desk-border)] px-4 py-4 sm:px-5">
          <p className="mb-2 font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
            Start from a template
          </p>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {WATCHLIST_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTemplate(t.id)}
                title={t.description}
                className="shrink-0 rounded-lg border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-3 py-2 text-left transition-colors hover:bg-[var(--desk-overlay-strong)]"
              >
                <span className="block text-xs font-medium text-[var(--desk-text)]">
                  {t.name}
                </span>
                <span className="mt-0.5 block max-w-[16rem] text-[0.68rem] text-[var(--desk-text-dim)]">
                  {t.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* AI helper */}
        <div className="border-b border-[var(--desk-border)] px-4 py-4 sm:px-5">
          <p className="mb-2 flex items-center gap-1.5 font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
            <Bot className="size-3.5" />
            Describe it — AI drafts the rule
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder='e.g. "biotech FDA catalysts, high impact only" or "insider buying on my core names"'
              rows={2}
              className="min-h-[2.25rem] w-full resize-none rounded-lg border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-2.5 py-1.5 text-sm text-[var(--desk-text)] placeholder:text-[var(--desk-text-dim)] focus-visible:border-[var(--desk-live)] focus-visible:outline-none"
            />
            <Button
              type="button"
              disabled={aiLoading}
              onClick={() => void runAi()}
              className="shrink-0 gap-1.5 bg-[var(--desk-live)] text-[#121212] hover:brightness-110 sm:w-auto"
            >
              {aiLoading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              {isCriteriaEmpty(criteria) ? "Draft with AI" : "Refine with AI"}
            </Button>
          </div>
          {aiRationale ? (
            <p className="mt-2 text-xs text-[var(--desk-text-muted)]">
              <span className="font-medium text-[var(--desk-text-secondary)]">
                AI:
              </span>{" "}
              {aiRationale}
            </p>
          ) : null}
        </div>

        {/* Manual fields */}
        <div className="flex flex-col gap-4 border-b border-[var(--desk-border)] px-4 py-4 sm:px-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[var(--desk-text-secondary)]">
              Name
            </span>
            <Input
              value={draft.name}
              onChange={(e) =>
                setDraft((d) => ({ ...d, name: e.target.value }))
              }
              placeholder="e.g. Biotech FDA catalysts"
              aria-label="Watchlist name"
              className="h-9 border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)]"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-[var(--desk-text-secondary)]">
                Symbols (exact, comma-separated)
              </span>
              <Input
                value={draft.symbolsText}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, symbolsText: e.target.value }))
                }
                placeholder="NVDA, AAPL"
                aria-label="Symbols"
                className="h-9 border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] font-mono text-xs"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-[var(--desk-text-secondary)]">
                Free-text search (optional)
              </span>
              <Input
                value={draft.q}
                onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
                placeholder="Fallback only — prefer fields above"
                aria-label="Free-text search"
                className="h-9 border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] font-mono text-xs"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FeedFilterMultiSelect
              label="Event type"
              options={CATEGORY_OPTIONS}
              selected={draft.categories}
              onChange={(categories) => setDraft((d) => ({ ...d, categories }))}
              emptyLabel="Any event type"
              searchPlaceholder="Search event types…"
            />
            <FeedFilterMultiSelect
              label="Form"
              options={FORM_OPTIONS}
              selected={draft.forms}
              onChange={(forms) => setDraft((d) => ({ ...d, forms }))}
              emptyLabel="Any form"
              searchPlaceholder="Search forms…"
            />
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[var(--desk-text-secondary)]">
              Tags (any-match, comma-separated)
            </span>
            <Input
              value={draft.tagsText}
              onChange={(e) =>
                setDraft((d) => ({ ...d, tagsText: e.target.value }))
              }
              placeholder="impact:high, fda"
              aria-label="Tags"
              className="h-9 border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] font-mono text-xs"
            />
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => addQuickTag(tag)}
                  className="rounded-full border border-[var(--desk-border)] px-2 py-0.5 font-mono text-[0.65rem] text-[var(--desk-text-dim)] transition-colors hover:border-[var(--desk-border-strong)] hover:text-[var(--desk-text)]"
                >
                  + {tagLabel(tag)}
                </button>
              ))}
            </div>
          </label>

          {isLocalDevUi() ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-[var(--desk-text-secondary)]">
                Sources (local-dev only, comma-separated)
              </span>
              <Input
                value={draft.sourcesText}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, sourcesText: e.target.value }))
                }
                placeholder="sec-edgar, polygon-news"
                aria-label="Sources"
                className="h-9 border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] font-mono text-xs"
              />
            </label>
          ) : null}
        </div>

        {/* Live preview + save */}
        <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
          {draftChips.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {draftChips.map((chip, i) => (
                <span
                  key={`${chip}-${i}`}
                  className="rounded-full border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-2 py-0.5 font-mono text-[0.65rem] text-[var(--desk-text-secondary)]"
                >
                  {chip}
                </span>
              ))}
            </div>
          ) : null}
          <div className="rounded-lg border border-[var(--desk-border)] bg-[var(--desk-header)]/60 px-3 py-3">
            <PreviewList preview={preview} />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[var(--desk-text-dim)]">
              {editingId
                ? "Updating an existing watchlist."
                : "Creates a new watchlist."}
            </p>
            <div className="flex gap-2">
              {editingId || draft.name || draftChips.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={cancelEdit}
                  className="border-[var(--desk-border-strong)]"
                >
                  Cancel
                </Button>
              ) : null}
              <Button
                type="button"
                disabled={saving}
                onClick={() => void saveDraft()}
                className="gap-1.5 bg-[var(--desk-live)] text-[#121212] hover:brightness-110"
              >
                {saving
                  ? "Saving…"
                  : editingId
                    ? "Update watchlist"
                    : "Save watchlist"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Saved watchlists */}
      <section className="overflow-hidden rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)]">
        <div className="border-b border-[var(--desk-border)] px-4 py-4 sm:px-5">
          <h2 className="text-sm font-semibold text-[var(--desk-text)]">
            Your watchlists
          </h2>
          <p className="mt-1 text-sm text-[var(--desk-text-muted)]">
            {watchlists.length === 0
              ? "None yet — build one above."
              : `${watchlists.length} saved · apply one to the tape, or edit its conditions.`}{" "}
            Next phase: reference these from{" "}
            <Link href="/alerts" className="underline">
              alert rules
            </Link>
            .
          </p>
        </div>

        {watchlists.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center sm:px-5">
            <span className="grid size-12 place-items-center rounded-xl border border-dashed border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] text-[var(--desk-text-dim)]">
              <ListFilter className="size-5" aria-hidden />
            </span>
            <p className="text-sm text-[var(--desk-text-muted)]">
              No watchlists yet — try a template, describe one to AI, or build
              one by hand above.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--desk-border)]">
            {watchlists.map((w) => {
              const chips = criteriaChips(w.criteria);
              const rowPreview = listPreviews[w.id] ?? null;
              const isOpen = expandedId === w.id;
              return (
                <li key={w.id} className="px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--desk-text)]">
                        {w.name}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {chips.length === 0 ? (
                          <span className="text-xs text-[var(--desk-text-dim)]">
                            No filters
                          </span>
                        ) : (
                          chips.map((chip, i) => (
                            <span
                              key={`${chip}-${i}`}
                              className="rounded-full border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-2 py-0.5 font-mono text-[0.65rem] text-[var(--desk-text-secondary)]"
                            >
                              {chip}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        href={feedHref({ criteria: w.criteria })}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-2.5 font-mono text-[0.7rem] text-[var(--desk-text-secondary)] transition-colors hover:bg-[var(--desk-overlay-strong)] hover:text-[var(--desk-text)]"
                      >
                        <ListFilter className="size-3" />
                        Apply
                      </Link>
                      <button
                        type="button"
                        onClick={() => void toggleListPreview(w.id)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-2.5 font-mono text-[0.7rem] text-[var(--desk-text-secondary)] transition-colors hover:bg-[var(--desk-overlay-strong)] hover:text-[var(--desk-text)]"
                        aria-expanded={isOpen}
                      >
                        <Eye className="size-3" />
                        Preview
                        <ChevronDown
                          className={cn(
                            "size-3 transition-transform",
                            isOpen && "rotate-180",
                          )}
                        />
                      </button>
                      <button
                        type="button"
                        aria-label={`Edit ${w.name}`}
                        onClick={() => editWatchlist(w)}
                        className="rounded-md p-2 text-[var(--desk-text-muted)] transition-colors hover:bg-[var(--desk-overlay-strong)] hover:text-[var(--desk-text)]"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${w.name}`}
                        disabled={deletingId === w.id}
                        onClick={() => void deleteWatchlist(w.id, w.name)}
                        className="rounded-md p-2 text-[var(--desk-text-muted)] transition-colors hover:bg-[var(--desk-overlay-strong)] hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>

                  {isOpen ? (
                    <div className="mt-3 rounded-lg border border-[var(--desk-border)] bg-[var(--desk-header)]/60 px-3 py-3">
                      <PreviewList preview={rowPreview} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
