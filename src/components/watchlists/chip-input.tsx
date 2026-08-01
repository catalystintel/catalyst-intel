"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Token/chip field for list-valued criteria (symbols, tags). Type + Enter (or
 * comma) commits a chip; Backspace on an empty input removes the last one.
 * Friendlier than a comma-separated text box — the value is always visible as
 * discrete, removable items.
 */
export function ChipInput({
  values,
  onChange,
  placeholder,
  ariaLabel,
  transform = (v) => v,
  suggestions = [],
  suggestionLabel = (v) => v,
  chipClassName,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  ariaLabel: string;
  /** Normalizer applied on commit (e.g. uppercase symbols, lowercase tags). */
  transform?: (value: string) => string;
  /** One-click additions shown under the field. */
  suggestions?: string[];
  suggestionLabel?: (value: string) => string;
  chipClassName?: string;
}) {
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const next = transform(raw.trim());
    if (!next) return;
    if (!values.includes(next)) onChange([...values, next]);
    setDraft("");
  }

  function remove(value: string) {
    onChange(values.filter((v) => v !== value));
  }

  const openSuggestions = suggestions.filter((s) => !values.includes(s));

  return (
    <div className="flex flex-col gap-2.5">
      <div
        className={cn(
          "flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-2 py-1.5",
          "focus-within:border-[var(--desk-live)]",
        )}
      >
        {values.map((value) => (
          <span
            key={value}
            className={cn(
              "inline-flex items-center gap-1 rounded-md bg-[var(--desk-overlay-strong)] px-1.5 py-0.5 font-mono text-[0.7rem] text-[var(--desk-text)]",
              chipClassName,
            )}
          >
            {value}
            <button
              type="button"
              onClick={() => remove(value)}
              aria-label={`Remove ${value}`}
              className="rounded-sm text-[var(--desk-text-muted)] hover:text-[var(--desk-text)]"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => {
            const raw = e.target.value;
            // Commit on comma so pasted "AAPL, MSFT" still tokenizes.
            if (raw.includes(",")) {
              for (const part of raw.split(",")) commit(part);
              return;
            }
            setDraft(raw);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(draft);
            } else if (e.key === "Backspace" && !draft && values.length > 0) {
              remove(values[values.length - 1]!);
            }
          }}
          onBlur={() => commit(draft)}
          placeholder={values.length === 0 ? placeholder : ""}
          aria-label={ariaLabel}
          className="min-w-24 flex-1 bg-transparent font-mono text-xs text-[var(--desk-text)] outline-none placeholder:text-[var(--desk-text-dim)]"
        />
      </div>
      {openSuggestions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[0.62rem] tracking-[0.12em] text-[var(--desk-text-dim)] uppercase">
            Common tags
          </span>
          <div className="flex flex-wrap gap-2">
            {openSuggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => commit(s)}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--desk-border-strong)] px-2 py-1 font-mono text-[0.65rem] text-[var(--desk-text-muted)] transition-colors hover:border-[var(--desk-live)]/50 hover:text-[var(--desk-text)]"
              >
                <Plus className="size-2.5" />
                {suggestionLabel(s)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
