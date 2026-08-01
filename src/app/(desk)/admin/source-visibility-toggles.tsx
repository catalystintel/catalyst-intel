"use client";

import { useCallback, useEffect, useState } from "react";

import type { CatalystSourceId } from "@/lib/jobs/catalyst-sources";

interface CatalogEntry {
  id: CatalystSourceId;
  label: string;
  contributes: string;
  fetchEnabled: boolean;
}

interface SourceSettingsResponse {
  enabledSources: CatalystSourceId[];
  persisted: boolean;
  catalog: CatalogEntry[];
  error?: string;
}

/**
 * Admin-only personal feed source toggles. On = show that vendor in *your*
 * Catalyst / News feeds. Off = hide for you only (ingest unchanged).
 */
export function SourceVisibilityToggles() {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [enabled, setEnabled] = useState<Set<CatalystSourceId>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/source-settings", {
          credentials: "same-origin",
          cache: "no-store",
        });
        const data = (await res.json()) as SourceSettingsResponse;
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to load source settings.");
        }
        if (cancelled) return;
        setCatalog(data.catalog);
        setEnabled(new Set(data.enabledSources));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (next: Set<CatalystSourceId>) => {
    setSaving(true);
    setError(null);
    setSavedHint(false);
    try {
      const res = await fetch("/api/admin/source-settings", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabledSources: [...next] }),
      });
      const data = (await res.json()) as SourceSettingsResponse;
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to save.");
      }
      setEnabled(new Set(data.enabledSources));
      setSavedHint(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }, []);

  function toggle(id: CatalystSourceId) {
    const next = new Set(enabled);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setEnabled(next);
    void persist(next);
  }

  function setAll(on: boolean) {
    const next = new Set<CatalystSourceId>(on ? catalog.map((c) => c.id) : []);
    setEnabled(next);
    void persist(next);
  }

  if (loading) {
    return (
      <p className="font-mono text-xs text-[var(--desk-text-muted)]">
        Loading your feed sources…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => setAll(true)}
          className="btn-press rounded-sm border border-[var(--desk-border-strong)] px-2.5 py-1 font-mono text-[0.65rem] tracking-wide text-[var(--desk-text-secondary)] uppercase hover:bg-[var(--desk-overlay-strong)] disabled:opacity-50"
        >
          All on
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => setAll(false)}
          className="btn-press rounded-sm border border-[var(--desk-border-strong)] px-2.5 py-1 font-mono text-[0.65rem] tracking-wide text-[var(--desk-text-secondary)] uppercase hover:bg-[var(--desk-overlay-strong)] disabled:opacity-50"
        >
          All off
        </button>
        {saving ? (
          <span className="font-mono text-[0.65rem] text-[var(--desk-text-dim)]">
            Saving…
          </span>
        ) : savedHint ? (
          <span className="font-mono text-[0.65rem] text-[var(--desk-positive)]">
            Saved — applies to your feeds only
          </span>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-[var(--desk-negative)]">
          {error}
        </p>
      ) : null}

      <ul className="divide-y divide-[var(--desk-border)] border border-[var(--desk-border)]">
        {catalog.map((entry) => {
          const on = enabled.has(entry.id);
          return (
            <li
              key={entry.id}
              className="flex items-start justify-between gap-4 px-3 py-2.5 sm:px-4"
            >
              <div className="min-w-0">
                <p className="font-mono text-xs tracking-wide text-[var(--desk-text)]">
                  {entry.label}
                  {!entry.fetchEnabled ? (
                    <span className="ml-2 text-[var(--desk-text-dim)]">
                      (ingest paused)
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-xs leading-snug text-[var(--desk-text-muted)]">
                  {entry.contributes}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={`${entry.label} in my feeds`}
                disabled={saving}
                onClick={() => toggle(entry.id)}
                className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-sm border transition-colors disabled:opacity-50 ${
                  on
                    ? "border-[var(--desk-live)]/50 bg-[var(--desk-live)]/20"
                    : "border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)]"
                }`}
              >
                <span
                  aria-hidden
                  className={`absolute top-0.5 size-3.5 rounded-sm bg-[var(--desk-text)] transition-transform ${
                    on
                      ? "left-[1.05rem] bg-[var(--desk-live)]"
                      : "left-0.5 opacity-50"
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
