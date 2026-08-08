"use client";

import { useEffect, useState } from "react";
import posthog from "posthog-js";

import { Button } from "@/components/ui/button";
import { scrubEnvNamesFromMessage } from "@/lib/errors/user-facing";

interface SetupStepResult {
  ok: boolean;
  detail: string;
}

interface TelegramSetupResult {
  ok: boolean;
  webhookUrl?: string;
  botUsername?: string | null;
  bot?: { id?: number; username?: string; firstName?: string };
  steps?: Record<string, SetupStepResult>;
  ranAt?: string;
  error?: string;
}

interface TelegramStatus {
  configured: boolean;
  botUsername: string | null;
  webhookUrl: string;
  liveWebhookUrl?: string | null;
  webhookMatches?: boolean | null;
  pendingUpdateCount?: number | null;
  lastWebhookError?: string | null;
}

export function TelegramBotSetup() {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TelegramSetupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/telegram/setup");
        const data = (await res.json()) as TelegramStatus & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Could not load status.");
        if (!cancelled) setStatus(data);
      } catch {
        // Soft — panel still shows the setup button.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSetup() {
    setLoading(true);
    setError(null);
    setResult(null);
    posthog.capture("telegram_bot_setup_triggered");
    try {
      const res = await fetch("/api/admin/telegram/setup", { method: "POST" });
      const data = (await res.json()) as TelegramSetupResult;
      if (!res.ok && !data.steps) {
        throw new Error(data.error ?? "Telegram setup failed.");
      }
      setResult(data);
      if (data.ok) {
        posthog.capture("telegram_bot_setup_completed", {
          bot_username: data.botUsername ?? data.bot?.username ?? null,
        });
        setStatus((prev) =>
          prev
            ? {
                ...prev,
                configured: true,
                botUsername:
                  data.botUsername ?? data.bot?.username ?? prev.botUsername,
                webhookUrl: data.webhookUrl ?? prev.webhookUrl,
              }
            : prev,
        );
      } else {
        posthog.capture("telegram_bot_setup_partial", {
          failed_steps: Object.entries(data.steps ?? {})
            .filter(([, s]) => !s.ok)
            .map(([name]) => name),
        });
      }
    } catch (err) {
      const message = scrubEnvNamesFromMessage(
        err instanceof Error ? err.message : "Telegram setup failed.",
      );
      setError(message);
      posthog.capture("telegram_bot_setup_error", { error_message: message });
    } finally {
      setLoading(false);
    }
  }

  const username =
    result?.botUsername ?? result?.bot?.username ?? status?.botUsername;
  const handle = username ? `@${username.replace(/^@/, "")}` : null;

  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Registers the webhook, slash commands (/start, /status, /mute, …), bot
        description, and the Catalyst Intel brand avatar. Users then Connect
        Telegram from /alerts (or paste a chat ID).
      </p>
      {status ? (
        <dl className="grid max-w-xl grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs">
          <dt className="text-muted-foreground">Token</dt>
          <dd className="text-foreground/90">
            {status.configured ? "Configured" : "Missing"}
          </dd>
          <dt className="text-muted-foreground">Bot</dt>
          <dd className="text-foreground/90">{handle ?? "—"}</dd>
          <dt className="text-muted-foreground">Webhook</dt>
          <dd className="truncate text-foreground/90">{status.webhookUrl}</dd>
          <dt className="text-muted-foreground">Live</dt>
          <dd className="truncate text-foreground/90">
            {status.liveWebhookUrl || "—"}
            {status.webhookMatches === false ? (
              <span className="ml-2 text-destructive">mismatch</span>
            ) : null}
            {status.webhookMatches === true ? (
              <span className="ml-2 text-[var(--desk-live-status)]">ok</span>
            ) : null}
          </dd>
          {status.lastWebhookError ? (
            <>
              <dt className="text-muted-foreground">Last error</dt>
              <dd className="text-destructive">{status.lastWebhookError}</dd>
            </>
          ) : null}
        </dl>
      ) : null}
      <Button
        onClick={handleSetup}
        disabled={loading || status?.configured === false}
        variant="outline"
        className="btn-press w-fit border-[var(--desk-border-strong)] bg-transparent text-[var(--desk-text)] hover:bg-[var(--desk-overlay-strong)]"
      >
        {loading ? "Setting up…" : "Setup Telegram bot"}
      </Button>
      {status?.configured === false ? (
        <p className="font-mono text-xs text-[var(--desk-text-dim)]">
          Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET on this deployment
          first.
        </p>
      ) : null}
      {error ? (
        <p className="font-mono text-sm text-destructive">{error}</p>
      ) : null}
      {result ? (
        <div className="space-y-2 font-mono text-xs text-[var(--desk-text-muted)]">
          <p>
            {result.ok ? "Setup complete" : "Setup finished with errors"}
            {result.ranAt
              ? ` · ${new Date(result.ranAt).toLocaleTimeString()}`
              : ""}
            {handle ? ` · ${handle}` : ""}
          </p>
          {result.steps ? (
            <ul className="space-y-1">
              {Object.entries(result.steps).map(([name, step]) => (
                <li key={name}>
                  <span
                    className={
                      step.ok ? "text-[var(--desk-live)]" : "text-destructive"
                    }
                  >
                    {step.ok ? "ok" : "fail"}
                  </span>{" "}
                  {name}
                  {!step.ok ? ` — ${step.detail}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
