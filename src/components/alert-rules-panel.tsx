"use client";

import { useCallback, useEffect, useState } from "react";
import { FlaskConical, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AlertChannel, AlertRuleConditions } from "@/db/schema";
import { cn } from "@/lib/utils";

interface AlertRuleRow {
  id: number;
  name: string;
  channel: AlertChannel;
  enabled: boolean;
  webhookUrl: string | null;
  emailTo: string | null;
  conditions: AlertRuleConditions;
  createdAt: string;
}

export function AlertRulesPanel() {
  const [rules, setRules] = useState<AlertRuleRow[]>([]);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("AH/PM bombs");
  const [channel, setChannel] = useState<AlertChannel>("webhook");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [minImpact, setMinImpact] = useState("70");
  const [sessionsAhPm, setSessionsAhPm] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/alert-rules", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load rules.");
      setError(null);
      setRules(data.rules ?? []);
      setEmailConfigured(Boolean(data.emailConfigured));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed.");
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

  async function createRule(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const conditions: AlertRuleConditions = {
        minImpact: Number(minImpact) || 70,
        sessions: sessionsAhPm ? ["AH", "PM"] : ["any"],
      };
      const res = await fetch("/api/alert-rules", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          channel,
          webhookUrl: channel === "webhook" ? webhookUrl : undefined,
          emailTo: channel === "email" ? emailTo : undefined,
          conditions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create rule.");
      setWebhookUrl("");
      await load();
      setMessage("Rule saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create rule.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRule(id: number) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/alert-rules?id=${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not delete rule.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete rule.");
    } finally {
      setSaving(false);
    }
  }

  async function testRule(id: number) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/alert-rules/test", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleId: id, force: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Test fire failed.");
      const lines = (data.results ?? [])
        .map(
          (r: { channel: string; ok: boolean; detail: string }) =>
            `${r.channel}: ${r.ok ? "ok" : "fail"} — ${r.detail}`,
        )
        .join("; ");
      setMessage(lines || "Test completed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test fire failed.");
    } finally {
      setSaving(false);
    }
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
      {message ? (
        <p className="font-mono text-sm text-[var(--desk-live)]">{message}</p>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)]">
        <div className="border-b border-[var(--desk-border)] px-4 py-4 sm:px-5">
          <h2 className="text-sm font-semibold text-[var(--desk-text)]">
            New alert rule
          </h2>
          <p className="mt-1 text-sm text-[var(--desk-text-muted)]">
            Webhook always works. Email needs{" "}
            <code className="font-mono text-[0.75rem]">RESEND_API_KEY</code>
            {emailConfigured
              ? " (configured)"
              : " (not set — will fail on send)"}
            . Push is coming soon.
          </p>
        </div>
        <form
          onSubmit={createRule}
          className="flex flex-col gap-3 px-4 py-4 sm:px-5"
        >
          <div className="flex flex-wrap gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Rule name"
              aria-label="Rule name"
              className="h-9 w-48 border-[var(--desk-border-strong)] bg-white/[0.02]"
            />
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as AlertChannel)}
              aria-label="Channel"
              className="h-9 rounded-md border border-[var(--desk-border-strong)] bg-white/[0.02] px-2 font-mono text-xs text-[var(--desk-text)]"
            >
              <option value="webhook">Webhook</option>
              <option value="email">Email</option>
              <option value="push">Push (coming soon)</option>
            </select>
            <Input
              value={minImpact}
              onChange={(e) => setMinImpact(e.target.value)}
              placeholder="Min impact"
              aria-label="Minimum impact score"
              className="h-9 w-28 border-[var(--desk-border-strong)] bg-white/[0.02] font-mono text-xs"
            />
            <label className="inline-flex items-center gap-2 font-mono text-xs text-[var(--desk-text-muted)]">
              <input
                type="checkbox"
                checked={sessionsAhPm}
                onChange={(e) => setSessionsAhPm(e.target.checked)}
              />
              AH / PM only
            </label>
          </div>
          {channel === "webhook" ? (
            <Input
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.example.com/…"
              aria-label="Webhook URL"
              className="h-9 border-[var(--desk-border-strong)] bg-white/[0.02] font-mono text-xs"
            />
          ) : null}
          {channel === "email" ? (
            <Input
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="you@example.com"
              aria-label="Email recipient"
              type="email"
              className="h-9 border-[var(--desk-border-strong)] bg-white/[0.02] font-mono text-xs"
            />
          ) : null}
          {channel === "push" ? (
            <p className="font-mono text-xs text-[var(--desk-text-dim)]">
              Push notifications are stubbed — rules can be saved but will not
              deliver until FCM is wired.
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={saving}
            className="btn-press w-fit gap-1.5 bg-[var(--desk-live)] text-[#121212] hover:brightness-110"
          >
            <Plus className="size-3.5" />
            Save rule
          </Button>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)]">
        <div className="border-b border-[var(--desk-border)] px-4 py-4 sm:px-5">
          <h2 className="text-sm font-semibold text-[var(--desk-text)]">
            Saved rules
          </h2>
        </div>
        {rules.length === 0 ? (
          <p className="px-4 py-6 font-mono text-xs text-[var(--desk-text-dim)] sm:px-5">
            No rules yet.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--desk-border)]">
            {rules.map((rule) => (
              <li
                key={rule.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm text-[var(--desk-text)]">
                    {rule.name}{" "}
                    <span
                      className={cn(
                        "ml-1 text-[0.7rem] uppercase",
                        rule.enabled
                          ? "text-[var(--desk-live)]"
                          : "text-[var(--desk-text-dim)]",
                      )}
                    >
                      {rule.channel}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[0.7rem] text-[var(--desk-text-dim)]">
                    {rule.channel === "webhook"
                      ? rule.webhookUrl
                      : rule.channel === "email"
                        ? rule.emailTo
                        : "Push · coming soon"}
                    {" · "}
                    min {rule.conditions.minImpact ?? 0}
                    {rule.conditions.sessions?.length
                      ? ` · ${rule.conditions.sessions.join("/")}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={saving}
                    onClick={() => void testRule(rule.id)}
                    className="gap-1.5 font-mono text-xs"
                  >
                    <FlaskConical className="size-3.5" />
                    Test
                  </Button>
                  <button
                    type="button"
                    aria-label={`Delete ${rule.name}`}
                    disabled={saving}
                    onClick={() => void deleteRule(rule.id)}
                    className="rounded-md p-2 text-[var(--desk-text-muted)] hover:bg-white/[0.05] hover:text-red-300"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
