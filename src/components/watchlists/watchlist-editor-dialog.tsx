"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  LayoutTemplate,
  Loader2,
  PencilRuler,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { ChipInput } from "@/components/watchlists/chip-input";
import {
  fetchDraftPreview,
  PreviewRows,
  type PreviewState,
} from "@/components/watchlists/watchlist-preview";
import { FeedFilterMultiSelect } from "@/components/feed-filter-multi-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { WatchlistCriteria } from "@/db/schema";
import {
  FEED_FORM_FILTERS,
  FEED_FORM_LABELS,
} from "@/lib/catalysts/feed-form-filters";
import { CATEGORY_LABELS, isEventCategoryKey } from "@/lib/catalysts/taxonomy";
import { isLocalDevUi } from "@/lib/dev/local-dev-ui";
import { toUserFacingMessage } from "@/lib/errors/user-facing";
import { isCriteriaEmpty, tagLabel } from "@/lib/watchlist/criteria-display";
import { WATCHLIST_TEMPLATES } from "@/lib/watchlist/templates";
import { cn } from "@/lib/utils";

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(
  ([value, label]) => ({ value, label }),
);
const FORM_OPTIONS = FEED_FORM_FILTERS.map((value) => ({
  value,
  label: FEED_FORM_LABELS[value],
}));

const TAG_SUGGESTIONS = [
  "impact:high",
  "session:ah",
  "session:pm",
  "sentiment:bullish",
  "fda",
  "ma",
];

export interface WatchlistDraft {
  id: number | null;
  name: string;
  criteria: WatchlistCriteria;
}

type Step = "start" | "edit";

function patchCriteria(
  criteria: WatchlistCriteria,
  patch: Partial<WatchlistCriteria>,
): WatchlistCriteria {
  const next: WatchlistCriteria = { ...criteria, ...patch };
  // Drop empty axes so "no filter" never persists as an empty array.
  for (const key of [
    "symbols",
    "categories",
    "forms",
    "tags",
    "sources",
  ] as const) {
    if (next[key] && next[key]!.length === 0) delete next[key];
  }
  if (!next.q?.trim()) delete next.q;
  return next;
}

/**
 * Guided create/edit flow: pick a starting point (template, plain-English AI
 * prompt, or blank), then refine the rule with live match feedback before
 * saving. Replaces the old always-expanded inline form.
 */
export function WatchlistEditorDialog({
  open,
  draft,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  /** `id: null` = create. Pass a prefilled draft to open straight into edit. */
  draft: WatchlistDraft | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void | Promise<void>;
}) {
  const isEdit = Boolean(draft?.id);
  const [step, setStep] = useState<Step>("start");
  const [name, setName] = useState("");
  const [criteria, setCriteria] = useState<WatchlistCriteria>({});
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRationale, setAiRationale] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<PreviewState>(null);

  // Seed from the incoming draft each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      setName(draft?.name ?? "");
      setCriteria(draft?.criteria ?? {});
      setStep(draft && !isCriteriaEmpty(draft.criteria) ? "edit" : "start");
      setAiPrompt("");
      setAiRationale(null);
      setPreview(null);
    }, 0);
    return () => window.clearTimeout(id);
  }, [open, draft]);

  const criteriaKey = useMemo(() => JSON.stringify(criteria), [criteria]);

  useEffect(() => {
    if (!open || step !== "edit") return;
    const immediate = window.setTimeout(() => {
      setPreview(isCriteriaEmpty(criteria) ? null : "loading");
    }, 0);
    const debounced = window.setTimeout(() => {
      if (isCriteriaEmpty(criteria)) return;
      void fetchDraftPreview(criteria)
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 350);
    return () => {
      window.clearTimeout(immediate);
      window.clearTimeout(debounced);
    };
    // criteriaKey is the stable dep; `criteria` is a new object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criteriaKey, open, step]);

  function applyTemplate(templateId: string) {
    const template = WATCHLIST_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    setName(template.name);
    setCriteria(template.criteria);
    setAiRationale(null);
    setStep("edit");
  }

  async function runAi() {
    if (!aiPrompt.trim()) {
      toast.error("Describe what you want to track first.");
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
          existingName: name.trim() || undefined,
          existingCriteria: isCriteriaEmpty(criteria) ? undefined : criteria,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI drafting failed.");
      setName(typeof data.name === "string" ? data.name : name);
      setCriteria(data.criteria ?? {});
      setAiRationale(
        typeof data.rationale === "string" ? data.rationale : null,
      );
      setStep("edit");
    } catch (err) {
      toast.error(toUserFacingMessage(err, "AI drafting failed."));
    } finally {
      setAiLoading(false);
    }
  }

  async function save() {
    if (!name.trim()) {
      toast.error("Give your watchlist a name.");
      return;
    }
    if (isCriteriaEmpty(criteria)) {
      toast.error("Add at least one filter — symbols, event types, or tags.");
      return;
    }
    setSaving(true);
    try {
      const url = draft?.id ? `/api/watchlists/${draft.id}` : "/api/watchlists";
      const res = await fetch(url, {
        method: draft?.id ? "PATCH" : "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), criteria }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save watchlist.");
      toast.success(isEdit ? "Watchlist updated" : `Created “${name.trim()}”`);
      onOpenChange(false);
      await onSaved();
    } catch (err) {
      toast.error(toUserFacingMessage(err, "Could not save watchlist."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? "Edit watchlist"
              : step === "start"
                ? "New watchlist"
                : "Fine-tune your watchlist"}
          </DialogTitle>
          <DialogDescription>
            {step === "start"
              ? "A watchlist is a rule: specific symbols, event conditions, or both. Pick a starting point."
              : "Adjust anything below — the match preview updates as you go."}
          </DialogDescription>
        </DialogHeader>

        {step === "start" ? (
          <div className="flex flex-col gap-4">
            <section className="flex flex-col gap-2">
              <p className="flex items-center gap-1.5 font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-muted)] uppercase">
                <Sparkles className="size-3.5" />
                Describe it in plain English
              </p>
              <div className="flex gap-2">
                <Input
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void runAi();
                  }}
                  placeholder="e.g. after-hours biotech FDA news"
                  aria-label="Describe the watchlist"
                  className="h-9 border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)]"
                />
                <Button
                  type="button"
                  disabled={aiLoading}
                  onClick={() => void runAi()}
                  className="shrink-0 gap-1.5 bg-[var(--desk-live)] text-[#121212] hover:brightness-110"
                >
                  {aiLoading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )}
                  Draft
                </Button>
              </div>
            </section>

            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-[var(--desk-border)]" />
              <span className="font-mono text-[0.62rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
                or
              </span>
              <span className="h-px flex-1 bg-[var(--desk-border)]" />
            </div>

            <section className="flex flex-col gap-2">
              <p className="flex items-center gap-1.5 font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-muted)] uppercase">
                <LayoutTemplate className="size-3.5" />
                Start from a template
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {WATCHLIST_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t.id)}
                    className="rounded-lg border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-3 py-2 text-left transition-colors hover:border-[var(--desk-live)]/50 hover:bg-[var(--desk-overlay-strong)]"
                  >
                    <span className="block text-xs font-medium text-[var(--desk-text)]">
                      {t.name}
                    </span>
                    <span className="mt-0.5 block text-[0.68rem] leading-snug text-[var(--desk-text-dim)]">
                      {t.description}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <button
              type="button"
              onClick={() => setStep("edit")}
              className="inline-flex items-center gap-1.5 self-start font-mono text-[0.7rem] text-[var(--desk-text-muted)] underline-offset-2 hover:text-[var(--desk-text)] hover:underline"
            >
              <PencilRuler className="size-3" />
              Build it manually instead
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-[var(--desk-text-secondary)]">
                Name
              </span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Biotech FDA catalysts"
                aria-label="Watchlist name"
                autoFocus
                className="h-9 border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)]"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-[var(--desk-text-secondary)]">
                Symbols
              </span>
              <ChipInput
                values={criteria.symbols ?? []}
                onChange={(symbols) =>
                  setCriteria((c) => patchCriteria(c, { symbols }))
                }
                transform={(v) => v.toUpperCase()}
                placeholder="Type a ticker, press Enter (e.g. NVDA)"
                ariaLabel="Symbols"
              />
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-[var(--desk-text-secondary)]">
                Event conditions
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <FeedFilterMultiSelect
                  label="Event type"
                  options={CATEGORY_OPTIONS}
                  selected={(criteria.categories ?? []).filter(
                    isEventCategoryKey,
                  )}
                  onChange={(categories) =>
                    setCriteria((c) => patchCriteria(c, { categories }))
                  }
                  emptyLabel="Any event type"
                  searchPlaceholder="Search event types…"
                />
                <FeedFilterMultiSelect
                  label="Form"
                  options={FORM_OPTIONS}
                  selected={criteria.forms ?? []}
                  onChange={(forms) =>
                    setCriteria((c) => patchCriteria(c, { forms }))
                  }
                  emptyLabel="Any SEC form"
                  searchPlaceholder="Search forms…"
                />
              </div>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-[var(--desk-text-secondary)]">
                Tags
              </span>
              <ChipInput
                values={criteria.tags ?? []}
                onChange={(tags) =>
                  setCriteria((c) => patchCriteria(c, { tags }))
                }
                transform={(v) => v.toLowerCase()}
                placeholder="Type a tag, press Enter (e.g. fda)"
                ariaLabel="Tags"
                suggestions={TAG_SUGGESTIONS}
                suggestionLabel={tagLabel}
              />
            </label>

            <details className="group">
              <summary className="cursor-pointer font-mono text-[0.7rem] text-[var(--desk-text-muted)] hover:text-[var(--desk-text)]">
                More options
              </summary>
              <div className="mt-2 flex flex-col gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--desk-text-secondary)]">
                    Free-text search
                  </span>
                  <Input
                    value={criteria.q ?? ""}
                    onChange={(e) =>
                      setCriteria((c) =>
                        patchCriteria(c, { q: e.target.value }),
                      )
                    }
                    placeholder="Matches symbol, company, or title"
                    aria-label="Free-text search"
                    className="h-9 border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] font-mono text-xs"
                  />
                </label>
                {isLocalDevUi() ? (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-[var(--desk-text-secondary)]">
                      Sources (local dev only)
                    </span>
                    <ChipInput
                      values={criteria.sources ?? []}
                      onChange={(sources) =>
                        setCriteria((c) => patchCriteria(c, { sources }))
                      }
                      transform={(v) => v.toLowerCase()}
                      placeholder="sec-edgar"
                      ariaLabel="Sources"
                    />
                  </label>
                ) : null}
              </div>
            </details>

            <section className="flex flex-col gap-2 rounded-lg border border-[var(--desk-border)] bg-[var(--desk-header)]/60 px-3 py-2.5">
              <PreviewRows preview={preview} />
              <div className="flex gap-2">
                <Input
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void runAi();
                  }}
                  placeholder="Refine with AI — e.g. “only high impact”"
                  aria-label="Refine with AI"
                  className="h-8 border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={aiLoading}
                  onClick={() => void runAi()}
                  className="h-8 shrink-0 gap-1.5 border-[var(--desk-border-strong)] text-xs"
                >
                  {aiLoading ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Sparkles className="size-3" />
                  )}
                  Refine
                </Button>
              </div>
              {aiRationale ? (
                <p className="text-[0.7rem] text-[var(--desk-text-muted)]">
                  {aiRationale}
                </p>
              ) : null}
            </section>

            <div
              className={cn(
                "flex items-center gap-2 border-t border-[var(--desk-border)] pt-3",
                isEdit ? "justify-end" : "justify-between",
              )}
            >
              {isEdit ? null : (
                <button
                  type="button"
                  onClick={() => setStep("start")}
                  className="inline-flex items-center gap-1 font-mono text-[0.7rem] text-[var(--desk-text-muted)] hover:text-[var(--desk-text)]"
                >
                  <ArrowLeft className="size-3" />
                  Starting points
                </button>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="border-[var(--desk-border-strong)]"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={saving}
                  onClick={() => void save()}
                  className="bg-[var(--desk-live)] text-[#121212] hover:brightness-110"
                >
                  {saving
                    ? "Saving…"
                    : isEdit
                      ? "Save changes"
                      : "Create watchlist"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
