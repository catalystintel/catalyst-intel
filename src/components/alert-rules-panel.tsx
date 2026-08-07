"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import {
  Bell,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  FlaskConical,
  Info,
  Link2,
  List,
  Mail,
  MessageCircle,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { AlertRulesListSkeleton } from "@/components/alerts-page-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  AlertChannel,
  AlertRuleConditions,
  AlertSession,
  WatchlistCriteria,
} from "@/db/schema";
import {
  ALERT_SESSION_OPTIONS,
  formatSessionsForDisplay,
  sessionsFromSelection,
  type AlertSessionOptionValue,
} from "@/lib/alerts/format-message";
import { useWebPush } from "@/hooks/use-web-push";
import { toUserFacingMessage } from "@/lib/errors/user-facing";
import { cn } from "@/lib/utils";
import { criteriaSummary } from "@/lib/watchlist/criteria-display";

interface SavedWatchlistOption {
  id: number;
  name: string;
  criteria: WatchlistCriteria;
}

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

type ChannelMeta = {
  value: AlertChannel;
  label: string;
  blurb: string;
  Icon: typeof Bell;
};

const CHANNELS: ChannelMeta[] = [
  {
    value: "push",
    label: "Push",
    blurb: "Browser notifications — free, works with the tab closed",
    Icon: Bell,
  },
  {
    value: "telegram",
    label: "Telegram",
    blurb: "Connect the bot once — watchlist fires land on your phone",
    Icon: MessageCircle,
  },
  // Webhook paused until Slack/Discord-shaped payloads ship — revive with:
  // { value: "webhook", label: "Webhook", blurb: "POST JSON to any HTTPS URL", Icon: Link2 },
  {
    value: "email",
    label: "Email",
    blurb: "Delivered to the email on your signed-in account",
    Icon: Mail,
  },
];

function channelIcon(channel: AlertChannel) {
  if (channel === "webhook") return Link2;
  return CHANNELS.find((c) => c.value === channel)?.Icon ?? Bell;
}

function channelLabel(channel: AlertChannel) {
  if (channel === "webhook") return "Webhook";
  return CHANNELS.find((c) => c.value === channel)?.label ?? channel;
}

type ReadyState = "ready" | "action" | "blocked";

export function AlertRulesPanel() {
  const formId = useId();
  const [rules, setRules] = useState<AlertRuleRow[]>([]);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [pushAvailable, setPushAvailable] = useState(false);
  const [pushPublicKey, setPushPublicKey] = useState<string | null>(null);
  const [telegramConfigured, setTelegramConfigured] = useState(false);
  const [telegramBotUsername, setTelegramBotUsername] = useState<string | null>(
    null,
  );
  const [telegramBotName, setTelegramBotName] = useState<string | null>(null);
  const [telegramBotHandle, setTelegramBotHandle] = useState<string | null>(
    null,
  );
  const [telegramBotDeepLink, setTelegramBotDeepLink] = useState<string | null>(
    null,
  );
  const [telegramLinked, setTelegramLinked] = useState<{
    chatId: string;
    username: string | null;
    muted: boolean;
    mutedUntil: string | null;
  } | null>(null);
  const [linkingTelegram, setLinkingTelegram] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);

  const [name, setName] = useState("AH/PM bombs");
  const [channel, setChannel] = useState<AlertChannel>("push");
  const [channelSeeded, setChannelSeeded] = useState(false);
  // Webhook URL state reserved for a quick revive of the channel card.
  // const [webhookUrl, setWebhookUrl] = useState("");
  const [sessionEmail, setSessionEmail] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [selectedSessions, setSelectedSessions] = useState<
    AlertSessionOptionValue[]
  >(["AH", "PM"]);
  const [tagsInput, setTagsInput] = useState("");
  const [savedWatchlists, setSavedWatchlists] = useState<
    SavedWatchlistOption[]
  >([]);
  const [selectedWatchlistIds, setSelectedWatchlistIds] = useState<number[]>(
    [],
  );

  const webPush = useWebPush(pushPublicKey);

  const load = useCallback(async () => {
    try {
      const [rulesRes, watchlistsRes] = await Promise.all([
        fetch("/api/alert-rules", {
          credentials: "same-origin",
          cache: "no-store",
        }),
        fetch("/api/watchlists", {
          credentials: "same-origin",
          cache: "no-store",
        }),
      ]);
      const data = await rulesRes.json();
      if (!rulesRes.ok) throw new Error(data.error ?? "Could not load rules.");
      setRules(data.rules ?? []);
      setEmailConfigured(Boolean(data.emailConfigured));
      setSessionEmail(
        typeof data.sessionEmail === "string" ? data.sessionEmail : "",
      );
      setPushAvailable(Boolean(data.pushAvailable));
      setPushPublicKey(data.pushPublicKey ?? null);
      setTelegramConfigured(Boolean(data.telegramConfigured));
      const username =
        typeof data.telegramBotUsername === "string"
          ? data.telegramBotUsername
          : null;
      const handle =
        typeof data.telegramBotHandle === "string"
          ? data.telegramBotHandle
          : username
            ? `@${username.replace(/^@/, "")}`
            : null;
      const deepLink =
        typeof data.telegramBotDeepLink === "string"
          ? data.telegramBotDeepLink
          : username
            ? `https://t.me/${username.replace(/^@/, "")}`
            : null;
      setTelegramBotUsername(username);
      setTelegramBotName(
        typeof data.telegramBotName === "string" ? data.telegramBotName : null,
      );
      setTelegramBotHandle(handle);
      setTelegramBotDeepLink(deepLink);
      const linked =
        data.telegramLinked && typeof data.telegramLinked === "object"
          ? (data.telegramLinked as {
              chatId?: string;
              username?: string | null;
              muted?: boolean;
              mutedUntil?: string | null;
            })
          : null;
      if (linked?.chatId) {
        setTelegramLinked({
          chatId: linked.chatId,
          username: linked.username ?? null,
          muted: Boolean(linked.muted),
          mutedUntil: linked.mutedUntil ?? null,
        });
        setTelegramChatId((prev) => prev || linked.chatId!);
      } else {
        setTelegramLinked(null);
      }

      if (watchlistsRes.ok) {
        const wData = await watchlistsRes.json();
        const list = Array.isArray(wData.watchlists) ? wData.watchlists : [];
        setSavedWatchlists(
          list.map(
            (w: {
              id: number;
              name: string;
              criteria?: WatchlistCriteria;
            }) => ({
              id: w.id,
              name: w.name,
              criteria: w.criteria ?? {},
            }),
          ),
        );
        setSelectedWatchlistIds((prev) =>
          prev.filter((id) => list.some((w: { id: number }) => w.id === id)),
        );
      }
    } catch (err) {
      toast.error(toUserFacingMessage(err, "Load failed."));
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

  // Land on a channel that can actually work on this deployment.
  useEffect(() => {
    if (!loaded || channelSeeded) return;
    const id = window.setTimeout(() => {
      if (pushAvailable) setChannel("push");
      else if (telegramConfigured) setChannel("telegram");
      else if (emailConfigured && sessionEmail) setChannel("email");
      else setChannel("push");
      setChannelSeeded(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, [
    loaded,
    channelSeeded,
    pushAvailable,
    telegramConfigured,
    emailConfigured,
    sessionEmail,
  ]);

  function channelReady(ch: AlertChannel): {
    state: ReadyState;
    label: string;
  } {
    switch (ch) {
      case "push":
        if (!pushAvailable)
          return { state: "blocked", label: "Unavailable here" };
        if (webPush.status === "subscribed")
          return { state: "ready", label: "Browser ready" };
        if (webPush.status === "denied")
          return { state: "blocked", label: "Permission denied" };
        if (webPush.status === "unsupported")
          return { state: "blocked", label: "Unsupported browser" };
        if (webPush.status === "loading")
          return { state: "action", label: "Working…" };
        if (webPush.status === "error")
          return { state: "action", label: "Retry enable" };
        return { state: "action", label: "Enable first" };
      case "telegram":
        if (!telegramConfigured)
          return { state: "blocked", label: "Unavailable here" };
        if (telegramLinked) return { state: "ready", label: "Linked" };
        return {
          state: "action",
          label: "Connect first",
        };
      case "webhook":
        return { state: "blocked", label: "Paused" };
      case "email":
        if (!emailConfigured)
          return { state: "blocked", label: "Unavailable here" };
        if (!sessionEmail)
          return { state: "blocked", label: "No account email" };
        return { state: "ready", label: "Delivery ready" };
    }
  }

  function toggleSession(value: AlertSessionOptionValue) {
    setSelectedSessions((prev) => {
      if (prev.includes(value)) {
        const next = prev.filter((s) => s !== value);
        return next.length === 0 ? prev : next;
      }
      return [...prev, value];
    });
  }

  function toggleWatchlistId(id: number) {
    setSelectedWatchlistIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function watchlistNamesForRule(ids: number[] | undefined): string {
    if (!ids?.length) return "";
    const byId = new Map(savedWatchlists.map((w) => [w.id, w.name]));
    return ids.map((id) => byId.get(id) ?? `#${id}`).join(", ");
  }

  function canSave(): boolean {
    const ready = channelReady(channel);
    if (ready.state === "blocked") return false;
    if (channel === "webhook") return false;
    if (channel === "telegram" && !telegramChatId.trim() && !telegramLinked)
      return false;
    if (channel === "push" && webPush.status !== "subscribed") return false;
    if (channel === "email" && (!emailConfigured || !sessionEmail))
      return false;
    return selectedSessions.length > 0;
  }

  async function connectTelegram() {
    setLinkingTelegram(true);
    try {
      const res = await fetch("/api/telegram/link", {
        method: "POST",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start linking.");
      const deepLink = typeof data.deepLink === "string" ? data.deepLink : null;
      if (!deepLink) throw new Error("Missing Telegram deep link.");
      window.open(deepLink, "_blank", "noopener,noreferrer");
      toast.success("Opened Telegram — tap Start, then come back here.");
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        await load();
        // Stop early once linked.
        // load() updates telegramLinked asynchronously via setState — re-fetch.
        const check = await fetch("/api/alert-rules", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (check.ok) {
          const body = await check.json();
          if (body.telegramLinked?.chatId) break;
        }
      }
    } catch (err) {
      toast.error(toUserFacingMessage(err, "Could not connect Telegram."));
    } finally {
      setLinkingTelegram(false);
    }
  }

  async function disconnectTelegram() {
    try {
      const res = await fetch("/api/telegram/link", {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not unlink.");
      setTelegramLinked(null);
      toast.success("Telegram disconnected.");
      await load();
    } catch (err) {
      toast.error(toUserFacingMessage(err, "Could not unlink Telegram."));
    }
  }

  async function createRule(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave()) {
      toast.error("Finish channel setup before saving.");
      return;
    }
    setSaving(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      const sessions: AlertSession[] = sessionsFromSelection(selectedSessions);
      const conditions: AlertRuleConditions = {
        sessions,
        ...(tags.length > 0 ? { tags } : {}),
        ...(selectedWatchlistIds.length > 0
          ? { watchlistIds: selectedWatchlistIds }
          : {}),
      };
      const res = await fetch("/api/alert-rules", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          channel,
          telegramChatId:
            channel === "telegram"
              ? telegramChatId.trim() || telegramLinked?.chatId || undefined
              : undefined,
          conditions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create rule.");
      if (channel === "telegram") setTelegramChatId("");
      await load();
      toast.success(`Rule "${name}" saved — use Test to verify delivery.`);
    } catch (err) {
      toast.error(toUserFacingMessage(err, "Could not create rule."));
    } finally {
      setSaving(false);
    }
  }

  async function deleteRule(id: number, ruleName: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/alert-rules?id=${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not delete rule.");
      await load();
      toast.success(`Rule "${ruleName}" deleted`);
    } catch (err) {
      toast.error(toUserFacingMessage(err, "Could not delete rule."));
    } finally {
      setSaving(false);
    }
  }

  async function testRule(id: number) {
    setTestingId(id);
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
            `${r.channel}: ${r.ok ? "ok" : "fail"} — ${toUserFacingMessage(r.detail, r.ok ? "Delivered." : "Delivery failed.")}`,
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
      toast.error(toUserFacingMessage(err, "Test fire failed."));
    } finally {
      setSaving(false);
      setTestingId(null);
    }
  }

  if (!loaded) {
    return <AlertRulesListSkeleton />;
  }

  const activeReady = channelReady(channel);

  return (
    <div className="flex flex-col gap-8">
      {/* How it works */}
      <section
        aria-labelledby={`${formId}-howto`}
        className="alert-panel-enter overflow-hidden rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)]"
      >
        <div className="border-b border-[var(--desk-border)] px-4 py-4 sm:px-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] text-[var(--desk-live)]">
              <Info className="size-4" aria-hidden />
            </span>
            <div>
              <h2
                id={`${formId}-howto`}
                className="text-sm font-semibold text-[var(--desk-text)]"
              >
                How alert rules work
              </h2>
              <p className="mt-1 text-sm text-[var(--desk-text-muted)]">
                Rules watch the live tape. When a catalyst matches your filters,
                we fire on the channel you chose — even if you are away from the
                desk.
              </p>
            </div>
          </div>
        </div>
        <ol className="grid gap-0 sm:grid-cols-3">
          {[
            {
              n: "1",
              title: "Pick a channel",
              body: "Push, Telegram, or email — each card shows if it is ready on this deployment.",
            },
            {
              n: "2",
              title: "Finish setup",
              body: "Follow the short checklist for that channel (enable push, or paste a Telegram chat ID).",
            },
            {
              n: "3",
              title: "Save, then Test",
              body: "Save the rule, then hit Test to fire against the latest catalyst and confirm delivery.",
            },
          ].map((step, i) => (
            <li
              key={step.n}
              className={cn(
                "alert-step-enter relative flex gap-3 px-4 py-4 sm:px-5",
                i < 2 &&
                  "border-b border-[var(--desk-border)] sm:border-r sm:border-b-0",
              )}
              style={{ animationDelay: `${80 + i * 70}ms` }}
            >
              <span
                className="grid size-7 shrink-0 place-items-center rounded-md bg-[var(--desk-live)] font-mono text-[0.7rem] font-bold text-[#121212]"
                aria-hidden
              >
                {step.n}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--desk-text)]">
                  {step.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--desk-text-muted)]">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Create rule */}
      <section
        aria-labelledby={`${formId}-create`}
        className="alert-panel-enter overflow-hidden rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)]"
        style={{ animationDelay: "60ms" }}
      >
        <div className="border-b border-[var(--desk-border)] px-4 py-4 sm:px-5">
          <h2
            id={`${formId}-create`}
            className="text-sm font-semibold text-[var(--desk-text)]"
          >
            Create a rule
          </h2>
          <p className="mt-1 text-sm text-[var(--desk-text-muted)]">
            Start with where you want the alert. Setup fields appear for that
            channel only.
          </p>
        </div>

        <form
          onSubmit={createRule}
          className="flex flex-col gap-6 px-4 py-5 sm:px-5"
        >
          {/* Channel picker */}
          <fieldset>
            <legend className="mb-3 font-mono text-[0.65rem] tracking-[0.16em] text-[var(--desk-text-dim)] uppercase">
              1 · Delivery channel
            </legend>
            <div
              className="grid gap-2 sm:grid-cols-2"
              role="radiogroup"
              aria-label="Alert channel"
            >
              {CHANNELS.map((opt, i) => {
                const ready = channelReady(opt.value);
                const selected = channel === opt.value;
                const Icon = opt.Icon;
                const blurb =
                  opt.value === "telegram" && telegramBotHandle
                    ? `Open ${telegramBotHandle} → paste chat ID → get fires`
                    : opt.blurb;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setChannel(opt.value)}
                    className={cn(
                      "alert-channel-card btn-press group relative flex items-start gap-3 rounded-xl border px-3.5 py-3.5 text-left transition-[border-color,background-color,box-shadow,transform] duration-200",
                      selected
                        ? "border-[var(--desk-live)] bg-[color-mix(in_srgb,var(--desk-live)_10%,transparent)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--desk-live)_35%,transparent)]"
                        : "border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] hover:border-[var(--desk-text-dim)] hover:bg-[var(--desk-overlay-strong)]",
                    )}
                    style={{ animationDelay: `${100 + i * 50}ms` }}
                  >
                    <span
                      className={cn(
                        "grid size-10 shrink-0 place-items-center rounded-lg border transition-colors duration-200",
                        selected
                          ? "border-[color-mix(in_srgb,var(--desk-live)_45%,transparent)] bg-[color-mix(in_srgb,var(--desk-live)_16%,transparent)] text-[var(--desk-live)]"
                          : "border-[var(--desk-border-strong)] bg-[var(--desk-panel)] text-[var(--desk-text-muted)] group-hover:text-[var(--desk-text)]",
                      )}
                    >
                      <Icon className="size-[1.15rem]" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--desk-text)]">
                          {opt.label}
                        </span>
                        <ReadyBadge state={ready.state} label={ready.label} />
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-[var(--desk-text-muted)]">
                        {blurb}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Channel setup */}
          <div
            key={channel}
            className="alert-channel-panel rounded-xl border border-[var(--desk-border)] bg-[var(--desk-header)]/60 px-4 py-4 sm:px-5"
          >
            <p className="mb-3 font-mono text-[0.65rem] tracking-[0.16em] text-[var(--desk-text-dim)] uppercase">
              2 · Set up {channelLabel(channel)}
            </p>
            <ChannelSetup
              channel={channel}
              ready={activeReady}
              pushAvailable={pushAvailable}
              webPush={webPush}
              telegramConfigured={telegramConfigured}
              telegramBotUsername={telegramBotUsername}
              telegramBotName={telegramBotName}
              telegramBotHandle={telegramBotHandle}
              telegramBotDeepLink={telegramBotDeepLink}
              telegramLinked={telegramLinked}
              linkingTelegram={linkingTelegram}
              onConnectTelegram={() => void connectTelegram()}
              onDisconnectTelegram={() => void disconnectTelegram()}
              telegramChatId={telegramChatId}
              setTelegramChatId={setTelegramChatId}
              emailConfigured={emailConfigured}
              sessionEmail={sessionEmail}
            />
          </div>

          {/* Conditions */}
          <fieldset>
            <legend className="mb-3 font-mono text-[0.65rem] tracking-[0.16em] text-[var(--desk-text-dim)] uppercase">
              3 · When to fire
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 sm:col-span-2 sm:max-w-md">
                <span className="text-xs font-medium text-[var(--desk-text-secondary)]">
                  Rule name
                </span>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. AH/PM bombs"
                  aria-label="Rule name"
                  className="h-10 border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)]"
                />
              </label>
            </div>

            <label className="mt-4 flex flex-col gap-1.5">
              <span className="text-xs font-medium text-[var(--desk-text-secondary)]">
                Tags (optional, comma-separated)
              </span>
              <Input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="e.g. category:regulatory, fda"
                aria-label="Tag conditions"
                className="h-10 border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] font-mono text-xs"
              />
              <span className="text-[0.7rem] text-[var(--desk-text-dim)]">
                Fires only when the catalyst has at least one of these tags —
                auto-tags include <code className="font-mono">category:*</code>,{" "}
                <code className="font-mono">form:*</code>,{" "}
                <code className="font-mono">impact:*</code>. Same tags you can
                filter and save watchlists by on the tape.
              </span>
            </label>

            <div className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-[var(--desk-text-secondary)]">
                  Watchlists (optional)
                </p>
                <Link
                  href="/watchlist"
                  className="inline-flex items-center gap-1 font-mono text-[0.65rem] tracking-wide text-[var(--desk-live)] uppercase transition-opacity hover:opacity-80"
                >
                  <Plus className="size-3" aria-hidden />
                  Create watchlist
                  <ExternalLink className="size-3" aria-hidden />
                </Link>
              </div>
              <p className="mt-0.5 text-[0.7rem] text-[var(--desk-text-dim)]">
                Limit fires to catalysts matching any selected saved watchlist
                (same rules as Quiet mode). Leave empty to fire on all symbols.
              </p>
              {savedWatchlists.length === 0 ? (
                <div className="mt-2.5 flex flex-col gap-2 rounded-lg border border-dashed border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-[var(--desk-text-muted)]">
                    No saved watchlists yet — create one to gate this rule on
                    symbols, tags, or event types.
                  </p>
                  <Link
                    href="/watchlist"
                    className="btn-press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-2.5 font-mono text-xs text-[var(--desk-text-secondary)] transition-colors hover:bg-[var(--desk-overlay-strong)] hover:text-[var(--desk-text)]"
                  >
                    <List className="size-3.5" aria-hidden />
                    Open Watchlists
                  </Link>
                </div>
              ) : (
                <div
                  role="group"
                  aria-label="Watchlists"
                  className="mt-2.5 flex flex-col gap-1.5"
                >
                  {savedWatchlists.map((w) => {
                    const on = selectedWatchlistIds.includes(w.id);
                    return (
                      <button
                        key={w.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleWatchlistId(w.id)}
                        className={cn(
                          "btn-press flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors duration-200",
                          on
                            ? "border-[color-mix(in_srgb,var(--desk-live)_45%,transparent)] bg-[color-mix(in_srgb,var(--desk-live)_10%,transparent)]"
                            : "border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] hover:border-[var(--desk-text-dim)]",
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "mt-0.5 grid size-4 shrink-0 place-items-center rounded border",
                            on
                              ? "border-[var(--desk-live)] bg-[var(--desk-live)] text-[#121212]"
                              : "border-[var(--desk-border-strong)]",
                          )}
                        >
                          {on ? (
                            <CheckCircle2 className="size-3" aria-hidden />
                          ) : null}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-[var(--desk-text)]">
                            {w.name}
                          </span>
                          <span className="mt-0.5 block font-mono text-[0.65rem] text-[var(--desk-text-dim)]">
                            {criteriaSummary(w.criteria) || "Any catalyst"}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-4">
              <p className="text-xs font-medium text-[var(--desk-text-secondary)]">
                Sessions (US equities, Eastern Time)
              </p>
              <p className="mt-0.5 text-[0.7rem] text-[var(--desk-text-dim)]">
                Choose which tape sessions can fire this rule. Selecting all
                three is the same as any session.
              </p>
              <div
                role="group"
                aria-label="Sessions"
                className="mt-2.5 flex flex-wrap gap-2"
              >
                {ALERT_SESSION_OPTIONS.map((opt) => {
                  const on = selectedSessions.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleSession(opt.value)}
                      className={cn(
                        "btn-press rounded-lg border px-3 py-2 text-left transition-colors duration-200",
                        on
                          ? "border-[color-mix(in_srgb,var(--desk-live)_45%,transparent)] bg-[color-mix(in_srgb,var(--desk-live)_10%,transparent)]"
                          : "border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] hover:border-[var(--desk-text-dim)]",
                      )}
                    >
                      <span className="block text-sm font-medium text-[var(--desk-text)]">
                        {opt.label}
                      </span>
                      <span className="mt-0.5 block font-mono text-[0.65rem] text-[var(--desk-text-dim)]">
                        {opt.short} · {opt.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 font-mono text-[0.65rem] tracking-wide text-[var(--desk-text-dim)] uppercase">
                Fires on:{" "}
                {formatSessionsForDisplay(
                  sessionsFromSelection(selectedSessions),
                )}
              </p>
            </div>
          </fieldset>

          <div className="flex flex-col gap-2 border-t border-[var(--desk-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[var(--desk-text-dim)]">
              {canSave()
                ? "Ready to save. After saving, use Test on the rule to confirm delivery."
                : activeReady.state === "blocked"
                  ? `${channelLabel(channel)} is not available yet — pick another channel or fix the blocker above.`
                  : "Complete the channel checklist above, then save."}
            </p>
            <Button
              type="submit"
              disabled={saving || !canSave()}
              className="btn-press w-full gap-1.5 bg-[var(--desk-live)] text-[#121212] hover:brightness-110 sm:w-auto"
            >
              <Plus className="size-3.5" />
              Save rule
            </Button>
          </div>
        </form>
      </section>

      {/* Saved rules */}
      <section
        aria-labelledby={`${formId}-saved`}
        className="alert-panel-enter overflow-hidden rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)]"
        style={{ animationDelay: "120ms" }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--desk-border)] px-4 py-4 sm:px-5">
          <div>
            <h2
              id={`${formId}-saved`}
              className="text-sm font-semibold text-[var(--desk-text)]"
            >
              Your rules
            </h2>
            <p className="mt-1 text-sm text-[var(--desk-text-muted)]">
              {rules.length === 0
                ? "None yet — create one above."
                : `${rules.length} active · Test fires against the latest catalyst on the tape.`}
            </p>
          </div>
          {rules.length > 0 ? (
            <span className="hidden font-mono text-[0.65rem] tracking-[0.12em] text-[var(--desk-text-dim)] uppercase sm:inline">
              {rules.length} saved
            </span>
          ) : null}
        </div>

        {rules.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center sm:px-5">
            <span className="grid size-12 place-items-center rounded-xl border border-dashed border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] text-[var(--desk-text-dim)]">
              <Bell className="size-5" aria-hidden />
            </span>
            <p className="text-sm text-[var(--desk-text-muted)]">
              No rules yet. Pick a channel, finish setup, and save your first
              one.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--desk-border)]">
            {rules.map((rule, i) => {
              const Icon = channelIcon(rule.channel);
              const destination =
                rule.channel === "webhook"
                  ? rule.webhookUrl
                  : rule.channel === "email"
                    ? rule.emailTo
                    : rule.channel === "telegram"
                      ? `Chat ${rule.telegramChatId ?? "—"}`
                      : "This browser’s push subscriptions";
              return (
                <li
                  key={rule.id}
                  className="alert-rule-row flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                  style={{ animationDelay: `${40 + i * 45}ms` }}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] text-[var(--desk-live)]">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--desk-text)]">
                        {rule.name}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--desk-text-muted)]">
                        <span className="font-medium text-[var(--desk-text-secondary)]">
                          {channelLabel(rule.channel)}
                        </span>
                        <span
                          aria-hidden
                          className="text-[var(--desk-text-dim)]"
                        >
                          ·
                        </span>
                        <span className="truncate font-mono text-[0.7rem] text-[var(--desk-text-dim)]">
                          {destination}
                        </span>
                      </p>
                      <p className="mt-1 font-mono text-[0.65rem] tracking-wide text-[var(--desk-text-dim)] uppercase">
                        {formatSessionsForDisplay(rule.conditions.sessions)}
                        {rule.conditions.tags?.length
                          ? ` · tags: ${rule.conditions.tags.join(", ")}`
                          : ""}
                        {rule.conditions.watchlistIds?.length
                          ? ` · watchlists: ${watchlistNamesForRule(rule.conditions.watchlistIds)}`
                          : ""}
                        {rule.conditions.watchlistOnly
                          ? " · flat symbols only"
                          : ""}
                        {rule.enabled ? "" : " · paused"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={saving}
                      onClick={() => void testRule(rule.id)}
                      className="btn-press gap-1.5 border-[var(--desk-border-strong)] font-mono text-xs"
                    >
                      <FlaskConical
                        className={cn(
                          "size-3.5",
                          testingId === rule.id && "animate-spin",
                        )}
                      />
                      {testingId === rule.id ? "Firing…" : "Test"}
                    </Button>
                    <button
                      type="button"
                      aria-label={`Delete ${rule.name}`}
                      disabled={saving}
                      onClick={() => void deleteRule(rule.id, rule.name)}
                      className="btn-press rounded-md p-2 text-[var(--desk-text-muted)] transition-colors hover:bg-[var(--desk-overlay-strong)] hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function ReadyBadge({ state, label }: { state: ReadyState; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[0.6rem] tracking-wide uppercase",
        state === "ready" &&
          "bg-[color-mix(in_srgb,var(--desk-live-status)_14%,transparent)] text-[var(--desk-live-status)]",
        state === "action" &&
          "bg-[color-mix(in_srgb,var(--desk-live)_14%,transparent)] text-[var(--desk-live)]",
        state === "blocked" &&
          "bg-[var(--desk-overlay-strong)] text-[var(--desk-text-dim)]",
      )}
    >
      {state === "ready" ? (
        <CheckCircle2 className="size-2.5" aria-hidden />
      ) : (
        <CircleAlert className="size-2.5" aria-hidden />
      )}
      {label}
    </span>
  );
}

function SetupSteps({ steps }: { steps: string[] }) {
  return (
    <ol className="mb-4 space-y-2">
      {steps.map((step, i) => (
        <li
          key={step}
          className="flex gap-2.5 text-sm text-[var(--desk-text-secondary)]"
        >
          <span
            className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-[var(--desk-border-strong)] font-mono text-[0.6rem] text-[var(--desk-text-dim)]"
            aria-hidden
          >
            {i + 1}
          </span>
          <span className="leading-relaxed">{step}</span>
        </li>
      ))}
    </ol>
  );
}

function ChannelSetup({
  channel,
  ready,
  pushAvailable,
  webPush,
  telegramConfigured,
  telegramBotUsername,
  telegramBotName,
  telegramBotHandle,
  telegramBotDeepLink,
  telegramLinked,
  linkingTelegram,
  onConnectTelegram,
  onDisconnectTelegram,
  telegramChatId,
  setTelegramChatId,
  emailConfigured,
  sessionEmail,
}: {
  channel: AlertChannel;
  ready: { state: ReadyState; label: string };
  pushAvailable: boolean;
  webPush: ReturnType<typeof useWebPush>;
  telegramConfigured: boolean;
  telegramBotUsername: string | null;
  telegramBotName: string | null;
  telegramBotHandle: string | null;
  telegramBotDeepLink: string | null;
  telegramLinked: {
    chatId: string;
    username: string | null;
    muted: boolean;
    mutedUntil: string | null;
  } | null;
  linkingTelegram: boolean;
  onConnectTelegram: () => void;
  onDisconnectTelegram: () => void;
  telegramChatId: string;
  setTelegramChatId: (v: string) => void;
  emailConfigured: boolean;
  sessionEmail: string;
}) {
  if (channel === "push") {
    if (!pushAvailable) {
      return (
        <StatusCallout
          tone="blocked"
          title="Push isn’t available on this deployment"
          body="The server is missing VAPID keys. Pick Telegram or Email, or ask ops to enable Web Push — then you’ll enable browser notifications here in one click."
        />
      );
    }
    if (webPush.status === "denied") {
      return (
        <StatusCallout
          tone="blocked"
          title="Notification permission denied"
          body="Open your browser site settings for this origin, allow notifications, then reload and try again."
        />
      );
    }
    if (webPush.status === "unsupported") {
      return (
        <StatusCallout
          tone="blocked"
          title="This browser doesn’t support Web Push"
          body="Try Chrome, Edge, or Firefox on desktop — or pick Telegram or email."
        />
      );
    }
    return (
      <div>
        <SetupSteps
          steps={[
            "Click Enable browser notifications and allow permission when prompted.",
            "Save the rule — it uses this browser’s push subscription.",
            "Hit Test on the saved rule; you should get a notification even if this tab is closed.",
          ]}
        />
        {webPush.status === "subscribed" ? (
          <StatusCallout
            tone="ready"
            title="This browser is subscribed"
            body="You’re set. Name the rule, set your filters below, and save."
          />
        ) : (
          <div className="flex flex-col gap-3">
            <Button
              type="button"
              onClick={() => void webPush.subscribe()}
              disabled={webPush.status === "loading"}
              className="btn-press w-fit gap-2 bg-[var(--desk-live)] text-[#121212] hover:brightness-110 disabled:opacity-60"
            >
              <Bell className="size-3.5" />
              {webPush.status === "loading"
                ? "Enabling…"
                : webPush.status === "error"
                  ? "Retry browser notifications"
                  : "Enable browser notifications"}
            </Button>
            {webPush.error ? (
              <StatusCallout
                tone="blocked"
                title="Couldn’t enable push"
                body={webPush.error}
              />
            ) : null}
          </div>
        )}
      </div>
    );
  }

  if (channel === "telegram") {
    if (!telegramConfigured) {
      return (
        <StatusCallout
          tone="blocked"
          title="Telegram bot isn’t configured"
          body="This deployment is missing TELEGRAM_BOT_TOKEN. Use Push or Email for now, or ask ops to wire the bot (Admin → Setup Telegram bot)."
        />
      );
    }
    const handle =
      telegramBotHandle ??
      (telegramBotUsername
        ? `@${telegramBotUsername.replace(/^@/, "")}`
        : null);
    const displayName = telegramBotName?.trim() || "Catalyst Intel";
    void telegramBotDeepLink;
    void ready;

    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-3.5 py-3">
          <p className="font-mono text-[0.65rem] tracking-[0.16em] text-[var(--desk-text-dim)] uppercase">
            {telegramLinked ? "Linked" : "Connect"}
          </p>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-base font-semibold text-[var(--desk-text)]">
              {displayName}
            </span>
            {handle ? (
              <span className="font-mono text-sm text-[var(--desk-live)]">
                {handle}
              </span>
            ) : null}
          </div>
          {telegramLinked ? (
            <>
              <p className="mt-1 text-xs text-[var(--desk-text-muted)]">
                Chat{" "}
                <span className="font-mono text-[var(--desk-text)]">
                  {telegramLinked.chatId}
                </span>
                {telegramLinked.username
                  ? ` · @${telegramLinked.username}`
                  : ""}
                {telegramLinked.muted ? " · muted" : ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onDisconnectTelegram}
                  className="btn-press gap-2 border-[var(--desk-border-strong)] bg-transparent text-[var(--desk-text)] hover:bg-[var(--desk-overlay-strong)]"
                >
                  Disconnect
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-1 text-xs text-[var(--desk-text-muted)]">
                One tap opens Telegram with a link token. Tap Start there — no
                chat ID paste required.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={onConnectTelegram}
                  disabled={linkingTelegram}
                  className="btn-press gap-2 bg-[var(--desk-live)] text-[#121212] hover:brightness-110"
                >
                  <ExternalLink className="size-3.5" aria-hidden />
                  {linkingTelegram ? "Waiting for link…" : "Connect Telegram"}
                </Button>
              </div>
            </>
          )}
        </div>

        {!telegramLinked ? (
          <SetupSteps
            steps={[
              "Tap Connect Telegram (opens the bot with a one-time link).",
              "In Telegram, tap Start — you’ll see “Linked”.",
              "Save a Telegram rule here, then hit Test.",
            ]}
          />
        ) : null}

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-[var(--desk-text-secondary)]">
            Chat ID override{" "}
            <span className="font-normal text-[var(--desk-text-dim)]">
              (optional)
            </span>
          </span>
          <Input
            value={telegramChatId}
            onChange={(e) => setTelegramChatId(e.target.value)}
            placeholder={
              telegramLinked
                ? `Linked ${telegramLinked.chatId}`
                : "e.g. 123456789"
            }
            aria-label="Telegram chat ID override"
            inputMode="numeric"
            className="h-10 border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] font-mono text-xs"
          />
          <span className="text-[0.7rem] text-[var(--desk-text-dim)]">
            Leave blank to use your linked chat. Paste only for a manual
            override.
          </span>
        </label>
      </div>
    );
  }

  // Webhook channel UI paused — see CHANNELS comment above to revive.
  if (channel === "webhook") {
    return (
      <StatusCallout
        tone="blocked"
        title="Webhook alerts are paused"
        body="Use Push, Telegram, or Email. Existing webhook rules still appear in Your rules if you created them earlier."
      />
    );
  }

  // email
  if (!emailConfigured) {
    return (
      <StatusCallout
        tone="blocked"
        title="Email delivery isn’t configured"
        body="This deployment is missing the email provider key. Use Push or Telegram when those are enabled."
      />
    );
  }
  if (!sessionEmail) {
    return (
      <StatusCallout
        tone="blocked"
        title="No email on this account"
        body="Sign in with an account that has a verified email, then come back."
      />
    );
  }
  return (
    <div>
      <SetupSteps
        steps={[
          "Alerts always go to the email on your signed-in account (shown below).",
          "Save the rule with your session filters.",
          "Hit Test — check inbox (and spam) for the sample fire.",
        ]}
      />
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-[var(--desk-text-secondary)]">
          Delivers to
        </span>
        <Input
          value={sessionEmail}
          readOnly
          aria-label="Email recipient (signed-in account)"
          type="email"
          className="h-10 border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] font-mono text-xs opacity-90"
        />
        <span className="inline-flex items-center gap-1.5 text-[0.7rem] text-[var(--desk-live-status)]">
          <CheckCircle2 className="size-3" aria-hidden />
          {ready.label} — recipient locked to your account email
        </span>
      </label>
    </div>
  );
}

function StatusCallout({
  tone,
  title,
  body,
}: {
  tone: "ready" | "blocked";
  title: string;
  body: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border px-3.5 py-3",
        tone === "ready"
          ? "border-[color-mix(in_srgb,var(--desk-live-status)_35%,transparent)] bg-[color-mix(in_srgb,var(--desk-live-status)_08%,transparent)]"
          : "border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)]",
      )}
    >
      {tone === "ready" ? (
        <CheckCircle2
          className="mt-0.5 size-4 shrink-0 text-[var(--desk-live-status)]"
          aria-hidden
        />
      ) : (
        <CircleAlert
          className="mt-0.5 size-4 shrink-0 text-[var(--desk-live)]"
          aria-hidden
        />
      )}
      <div>
        <p className="text-sm font-medium text-[var(--desk-text)]">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--desk-text-muted)]">
          {body}
        </p>
      </div>
    </div>
  );
}
