"use client";

import { useCallback, useEffect, useState } from "react";
import { FlaskConical, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SkeletonCard } from "@/components/loading-skeleton";
import type { AlertChannel, AlertRuleConditions } from "@/db/schema";
import { useWebPush } from "@/hooks/use-web-push";
import { cn } from "@/lib/utils";

interface AlertRuleRow {
  id: number;
  name: string;
  channel: AlertChannel;
  enabled: boolean;
  webhookUrl: string | null;
  emailTo: string | null;
  telegramChatId: string | null;
  conditions: AlertRuleConditions;
  createdAt: string;
}

export function AlertRulesPanel() {
  const [rules, setRules] = useState<AlertRuleRow[]>([]);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [pushAvailable, setPushAvailable] = useState(false);
  const [pushPublicKey, setPushPublicKey] = useState<string | null>(null);
  const [telegramConfigured, setTelegramConfigured] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("AH/PM bombs");
  const [channel, setChannel] = useState<AlertChannel>("push");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [minImpact, setMinImpact] = useState("70");
  const [sessionsAhPm, setSessionsAhPm] = useState(true);

  const webPush = useWebPush(pushPublicKey);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/alert-rules", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load rules.");
      setRules(data.rules ?? []);
      setEmailConfigured(Boolean(data.emailConfigured));
      setPushAvailable(Boolean(data.pushAvailable));
      setPushPublicKey(data.pushPublicKey ?? null);
      setTelegramConfigured(Boolean(data.telegramConfigured));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Load failed.");
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
          telegramChatId: channel === "telegram" ? telegramChatId : undefined,
          conditions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create rule.");
      setWebhookUrl("");
      await load();
      toast.success(`Rule "${name}" saved`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not create rule.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteRule(id: number, name: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/alert-rules?id=${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not delete rule.");
      await load();
      toast.success(`Rule "${name}" deleted`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not delete rule.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function testRule(id: number) {
    setSaving(true);
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
      const results: { ok: boolean }[] = data.results ?? [];
      const allOk = results.length > 0 && results.every((r) => r.ok);
      if (allOk) {
        toast.success(lines || "Test completed.");
      } else {
        toast.error(lines || "Test completed with failures.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test fire failed.");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return (
      <div className="flex flex-col gap-8">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={2} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="overflow-hidden rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)]">
        <div className="border-b border-[var(--desk-border)] px-4 py-4 sm:px-5">
          <h2 className="text-sm font-semibold text-[var(--desk-text)]">
            New alert rule
          </h2>
          <p className="mt-1 text-sm text-[var(--desk-text-muted)]">
            Push (browser) is free and works even when this tab is closed —
            recommended. Telegram needs{" "}
            <code className="font-mono text-[0.75rem]">TELEGRAM_BOT_TOKEN</code>{" "}
            {telegramConfigured ? "(configured)" : "(not set)"}. Webhook always
            works. Email needs{" "}
            <code className="font-mono text-[0.75rem]">RESEND_API_KEY</code>
            {emailConfigured
              ? " (configured)"
              : " (not set — will fail on send)"}
            .
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
              className="h-9 w-48 border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)]"
            />
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as AlertChannel)}
              aria-label="Channel"
              className="h-9 rounded-md border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-2 font-mono text-xs text-[var(--desk-text)]"
            >
              <option value="push">Push (browser, free)</option>
              <option value="telegram">Telegram</option>
              <option value="webhook">Webhook</option>
              <option value="email">Email</option>
            </select>
            <Input
              value={minImpact}
              onChange={(e) => setMinImpact(e.target.value)}
              placeholder="Min impact"
              aria-label="Minimum impact score"
              className="h-9 w-28 border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] font-mono text-xs"
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
              className="h-9 border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] font-mono text-xs"
            />
          ) : null}
          {channel === "email" ? (
            <Input
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="you@example.com"
              aria-label="Email recipient"
              type="email"
              className="h-9 border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] font-mono text-xs"
            />
          ) : null}
          {channel === "telegram" ? (
            <div className="flex flex-col gap-1.5">
              <Input
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                placeholder="Chat ID (message the bot to get yours)"
                aria-label="Telegram chat ID"
                className="h-9 border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] font-mono text-xs"
              />
              <p className="font-mono text-[0.7rem] text-[var(--desk-text-dim)]">
                Message the bot once (any text) — it replies with your chat ID
                to paste here.
              </p>
            </div>
          ) : null}
          {channel === "push" ? (
            <div className="flex items-center gap-2">
              {!pushAvailable ? (
                <p className="font-mono text-xs text-[var(--desk-text-dim)]">
                  Server missing WEB_PUSH_VAPID keys — push will fail to send.
                </p>
              ) : webPush.status === "subscribed" ? (
                <p className="font-mono text-xs text-[var(--desk-live)]">
                  This browser is subscribed to push.
                </p>
              ) : webPush.status === "denied" ? (
                <p className="font-mono text-xs text-destructive">
                  Notification permission denied — enable it in browser
                  settings.
                </p>
              ) : webPush.status === "unsupported" ? (
                <p className="font-mono text-xs text-[var(--desk-text-dim)]">
                  This browser doesn&apos;t support push notifications.
                </p>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void webPush.subscribe()}
                  className="font-mono text-xs"
                >
                  Enable browser notifications
                </Button>
              )}
            </div>
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
                        : rule.channel === "telegram"
                          ? `Chat ${rule.telegramChatId ?? "—"}`
                          : "This browser's push subscriptions"}
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
                    onClick={() => void deleteRule(rule.id, rule.name)}
                    className="rounded-md p-2 text-[var(--desk-text-muted)] hover:bg-[var(--desk-overlay-strong)] hover:text-destructive"
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
