"use client";

import { useCallback, useEffect, useState } from "react";

interface SourceSettingsResponse {
  showSourceLabels: boolean;
  persisted: boolean;
  error?: string;
}

/**
 * Admin personal display switch: when on, Catalyst Feed rows / split /
 * details show the vendor source name (SEC EDGAR, Finnhub, …).
 */
export function ShowArticleSourceToggle() {
  const [on, setOn] = useState(false);
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
          throw new Error(data.error ?? "Failed to load display settings.");
        }
        if (cancelled) return;
        setOn(Boolean(data.showSourceLabels));
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

  const persist = useCallback(async (next: boolean) => {
    setSaving(true);
    setError(null);
    setSavedHint(false);
    try {
      const res = await fetch("/api/admin/source-settings", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showSourceLabels: next }),
      });
      const data = (await res.json()) as SourceSettingsResponse;
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to save.");
      }
      setOn(Boolean(data.showSourceLabels));
      setSavedHint(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }, []);

  if (loading) {
    return (
      <p className="font-mono text-xs text-[var(--desk-text-muted)]">
        Loading display settings…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="text-sm text-[var(--desk-negative)]">
          {error}
        </p>
      ) : null}

      <div className="flex items-start justify-between gap-4 border border-[var(--desk-border)] px-3 py-3 sm:px-4">
        <div className="min-w-0">
          <p className="font-mono text-xs tracking-wide text-[var(--desk-text)]">
            Show article source
          </p>
          <p className="mt-0.5 text-xs leading-snug text-[var(--desk-text-muted)]">
            When on, each Catalyst Feed row (and split / details) shows the
            vendor name — e.g. SEC EDGAR, Finnhub, PR Wire. Does not hide or
            filter any rows. Personal to your desk view only.
          </p>
          {saving ? (
            <p className="mt-2 font-mono text-[0.65rem] text-[var(--desk-text-dim)]">
              Saving…
            </p>
          ) : savedHint ? (
            <p className="mt-2 font-mono text-[0.65rem] text-[var(--desk-positive)]">
              Saved — applies on your Catalyst Feed
            </p>
          ) : null}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Show article source on feed"
          disabled={saving}
          onClick={() => {
            const next = !on;
            setOn(next);
            void persist(next);
          }}
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
      </div>
    </div>
  );
}
