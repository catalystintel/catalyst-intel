"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ComponentType } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  CircleAlert,
  FlaskConical,
  List,
  Mail,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

import { AlertRulesListSkeleton } from "@/components/alerts-page-skeleton";
import { TelegramIcon } from "@/components/telegram-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WatchlistCriteria } from "@/db/schema";
import {
  emptyNotificationChannels,
  type NotificationChannel,
  type NotificationChannelsState,
  type NotificationSettings,
} from "@/lib/alerts/settings-model";
import { useWebPush } from "@/hooks/use-web-push";
import { toUserFacingMessage } from "@/lib/errors/user-facing";
import {
  detectPushBrowser,
  detectPushPlatform,
  pushOsBlockedHint,
  pushSiteBlockedHint,
} from "@/lib/push/client-guidance";
import { cn } from "@/lib/utils";
import { criteriaSummary } from "@/lib/watchlist/criteria-display";

type StepId = 1 | 2 | 3;

interface SavedWatchlistOption {
  id: number;
  name: string;
  criteria: WatchlistCriteria;
}

interface AlertRuleRow {
  id: number;
  name: string;
  channel: string;
  enabled: boolean;
}

interface TelegramLinked {
  chatId: string;
  username: string | null;
  muted: boolean;
  mutedUntil: string | null;
}

type TelegramHealthStatus =
  "checking" | "bot_not_configured" | "not_linked" | "live" | "unreachable";

const TELEGRAM_HEALTH_POLL_MS = 45_000;

const STEPS: { id: StepId; label: string; blurb: string }[] = [
  { id: 1, label: "Methods", blurb: "How you get pinged" },
  { id: 2, label: "Watchlists", blurb: "What can fire" },
  { id: 3, label: "Review", blurb: "Save & test" },
];

const METHOD_META: {
  id: NotificationChannel;
  label: string;
  blurb: string;
  Icon: ComponentType<{ className?: string }>;
}[] = [
  {
    id: "push",
    label: "Push",
    blurb: "System banner on this device — even with the tab closed",
    Icon: Bell,
  },
  {
    id: "telegram",
    label: "Telegram",
    blurb: "Fires on your phone via the Catalyst Intel bot",
    Icon: TelegramIcon,
  },
  {
    id: "email",
    label: "Email",
    blurb: "Delivered to the email on your account",
    Icon: Mail,
  },
];

export function AlertRulesPanel() {
  const [step, setStep] = useState<StepId>(1);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [channels, setChannels] = useState<NotificationChannelsState>(
    emptyNotificationChannels(),
  );
  const [selectedWatchlistIds, setSelectedWatchlistIds] = useState<number[]>(
    [],
  );
  const [savedWatchlists, setSavedWatchlists] = useState<
    SavedWatchlistOption[]
  >([]);
  const [rules, setRules] = useState<AlertRuleRow[]>([]);

  const [emailConfigured, setEmailConfigured] = useState(false);
  const [sessionEmail, setSessionEmail] = useState("");
  const [pushAvailable, setPushAvailable] = useState(false);
  const [pushPublicKey, setPushPublicKey] = useState<string | null>(null);
  const [telegramConfigured, setTelegramConfigured] = useState(false);
  const [telegramBotHandle, setTelegramBotHandle] = useState<string | null>(
    null,
  );
  const [telegramBotName, setTelegramBotName] = useState<string | null>(null);
  const [telegramLinked, setTelegramLinked] = useState<TelegramLinked | null>(
    null,
  );
  const [telegramHealth, setTelegramHealth] =
    useState<TelegramHealthStatus>("checking");
  const [telegramHealthDetail, setTelegramHealthDetail] = useState<
    string | null
  >(null);
  const [linkingTelegram, setLinkingTelegram] = useState(false);

  const webPush = useWebPush(pushPublicKey);

  const refreshTelegramHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/telegram/link", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        status?: TelegramHealthStatus;
        detail?: string | null;
        linked?: (TelegramLinked & { linkedAt?: string }) | null;
        configured?: boolean;
      };
      if (!res.ok) {
        setTelegramHealth((prev) =>
          prev === "live" || prev === "unreachable" || prev === "checking"
            ? "unreachable"
            : "not_linked",
        );
        setTelegramHealthDetail(data.error ?? "Could not check Telegram.");
        return;
      }
      if (typeof data.configured === "boolean") {
        setTelegramConfigured(data.configured);
      }
      if (data.linked?.chatId) {
        setTelegramLinked({
          chatId: data.linked.chatId,
          username: data.linked.username ?? null,
          muted: Boolean(data.linked.muted),
          mutedUntil: data.linked.mutedUntil ?? null,
        });
      } else {
        setTelegramLinked(null);
      }
      const status =
        data.status === "live" ||
        data.status === "unreachable" ||
        data.status === "not_linked" ||
        data.status === "bot_not_configured"
          ? data.status
          : data.linked?.chatId
            ? "live"
            : "not_linked";
      setTelegramHealth(status);
      setTelegramHealthDetail(
        typeof data.detail === "string" ? data.detail : null,
      );
    } catch {
      setTelegramHealth((prev) =>
        prev === "not_linked" || prev === "bot_not_configured"
          ? prev
          : "unreachable",
      );
      setTelegramHealthDetail("Could not check Telegram connection.");
    }
  }, []);

  async function refreshNotifications() {
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
    if (!rulesRes.ok) throw new Error(data.error ?? "Could not load alerts.");

    const settings = (data.settings ?? {
      channels: emptyNotificationChannels(),
      watchlistIds: [],
    }) as NotificationSettings;

    setChannels(settings.channels);
    setSelectedWatchlistIds(settings.watchlistIds ?? []);
    setRules(Array.isArray(data.rules) ? data.rules : []);
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
    setTelegramBotHandle(handle);
    setTelegramBotName(
      typeof data.telegramBotName === "string" ? data.telegramBotName : null,
    );

    const linked =
      data.telegramLinked && typeof data.telegramLinked === "object"
        ? (data.telegramLinked as TelegramLinked & { chatId?: string })
        : null;
    if (linked?.chatId) {
      setTelegramLinked({
        chatId: linked.chatId,
        username: linked.username ?? null,
        muted: Boolean(linked.muted),
        mutedUntil: linked.mutedUntil ?? null,
      });
    } else {
      setTelegramLinked(null);
    }

    if (watchlistsRes.ok) {
      const wData = await watchlistsRes.json();
      const list = Array.isArray(wData.watchlists) ? wData.watchlists : [];
      setSavedWatchlists(
        list.map(
          (w: { id: number; name: string; criteria?: WatchlistCriteria }) => ({
            id: w.id,
            name: w.name,
            criteria: w.criteria ?? {},
          }),
        ),
      );
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await refreshNotifications();
        if (!cancelled) await refreshTelegramHealth();
      } catch (err) {
        if (!cancelled) {
          toast.error(
            toUserFacingMessage(err, "Could not load notifications."),
          );
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshTelegramHealth]);

  // Quiet health poll while Telegram is configured and the tab is visible.
  useEffect(() => {
    if (!telegramConfigured) return;

    let timer: number | null = null;

    const tick = () => {
      if (document.hidden) return;
      void refreshTelegramHealth();
    };

    timer = window.setInterval(tick, TELEGRAM_HEALTH_POLL_MS);
    const onVisibility = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (timer !== null) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [telegramConfigured, refreshTelegramHealth]);

  function methodAvailable(id: NotificationChannel): boolean {
    if (id === "push") return pushAvailable;
    if (id === "telegram") return telegramConfigured;
    return emailConfigured && Boolean(sessionEmail);
  }

  function methodReady(id: NotificationChannel): boolean {
    if (!methodAvailable(id)) return false;
    if (id === "push") return webPush.status === "subscribed";
    if (id === "telegram") {
      if (!telegramLinked) return false;
      // Keep Ready while the first probe runs; only fail closed on unreachable.
      if (telegramHealth === "unreachable") return false;
      return true;
    }
    return true;
  }

  function toggleChannel(id: NotificationChannel) {
    if (!methodAvailable(id)) {
      toast.error("That method isn’t available on this deployment.");
      return;
    }
    setChannels((prev) => {
      const next = !prev[id];
      if (next && id === "telegram" && !telegramLinked) {
        toast.message("Connect Telegram below, then turn it on.");
      }
      if (next && id === "push" && webPush.status !== "subscribed") {
        toast.message("Enable browser push below, then turn it on.");
      }
      return { ...prev, [id]: next };
    });
  }

  function toggleWatchlist(id: number) {
    setSelectedWatchlistIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
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
      // Prefer Telegram Web — macOS browsers often no-op t.me "START BOT"
      // when the desktop tg:// handler isn't installed.
      const webDeepLink =
        typeof data.webDeepLink === "string" ? data.webDeepLink : null;
      const deepLink = typeof data.deepLink === "string" ? data.deepLink : null;
      const openUrl = webDeepLink || deepLink;
      if (!openUrl) throw new Error("Missing Telegram deep link.");
      window.open(openUrl, "_blank", "noopener,noreferrer");
      toast.success(
        "Opened Telegram Web — tap Start, then come back here. If nothing opens, use Open in Web on t.me.",
      );
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        await refreshNotifications();
        await refreshTelegramHealth();
        const check = await fetch("/api/telegram/link", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!check.ok) continue;
        const body = (await check.json()) as {
          linked?: { chatId?: string } | null;
          status?: string;
        };
        if (body.linked?.chatId) break;
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
      setTelegramHealth("not_linked");
      setTelegramHealthDetail(null);
      setChannels((prev) => ({ ...prev, telegram: false }));
      toast.success("Telegram disconnected.");
      await refreshNotifications();
    } catch (err) {
      toast.error(toUserFacingMessage(err, "Could not unlink Telegram."));
    }
  }

  const enabledCount = (
    Object.entries(channels) as [NotificationChannel, boolean][]
  ).filter(([, on]) => on).length;

  function canGoToWatchlists(): boolean {
    return true;
  }

  function canGoToReview(): boolean {
    if (enabledCount === 0) return true;
    return selectedWatchlistIds.length > 0;
  }

  function canSave(): boolean {
    if (enabledCount === 0) return true;
    if (selectedWatchlistIds.length === 0) return false;
    for (const id of NOTIFICATION_CHANNEL_IDS) {
      if (!channels[id]) continue;
      if (!methodReady(id)) return false;
    }
    return true;
  }

  async function saveSettings(options?: { quiet?: boolean }) {
    if (!canSave()) {
      toast.error("Finish method setup and pick at least one watchlist.");
      return false;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/alert-rules/settings", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channels,
          watchlistIds: selectedWatchlistIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save.");
      if (data.settings) {
        setChannels(data.settings.channels);
        setSelectedWatchlistIds(data.settings.watchlistIds ?? []);
      }
      if (Array.isArray(data.rules)) setRules(data.rules);
      if (!options?.quiet) {
        toast.success(
          enabledCount === 0 ? "Notifications paused." : "Notifications saved.",
        );
      }
      await refreshNotifications();
      return true;
    } catch (err) {
      toast.error(toUserFacingMessage(err, "Could not save notifications."));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function testEnabled() {
    setTesting(true);
    try {
      const saved = await saveSettings({ quiet: true });
      if (!saved) return;
      const res = await fetch("/api/alert-rules/test", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Test failed.");
      const results = Array.isArray(data.results)
        ? (data.results as {
            channel?: string;
            ok?: boolean;
            skipped?: boolean;
            detail?: string;
          }[])
        : [];
      const delivered = results.filter((r) => r.ok && !r.skipped);
      const failed = results.filter((r) => !r.ok && !r.skipped);
      const summarize = (
        rows: { channel?: string; detail?: string }[],
      ): string =>
        rows
          .map((r) => {
            const channel = r.channel ?? "channel";
            return r.detail ? `${channel} (${r.detail})` : channel;
          })
          .join(" · ");
      if (failed.length > 0) {
        toast.error(
          `Test: ${failed.length} failed, ${delivered.length} delivered. ${summarize(failed)}`,
        );
      } else if (delivered.length === 0) {
        toast.message(
          "Nothing delivered — turn a method on, finish setup, save, then test.",
        );
      } else {
        toast.success(
          `Test fired — ${summarize(delivered) || `${delivered.length} delivery(ies)`}.`,
        );
      }
    } catch (err) {
      toast.error(toUserFacingMessage(err, "Test failed."));
    } finally {
      setTesting(false);
    }
  }

  if (!loaded) return <AlertRulesListSkeleton />;

  const methodsComplete =
    enabledCount > 0 &&
    NOTIFICATION_CHANNEL_IDS.every((id) => !channels[id] || methodReady(id));
  const watchlistsComplete = selectedWatchlistIds.length > 0;
  const reviewComplete = rules.some((r) => r.enabled);

  return (
    <div className="flex flex-col gap-6">
      <StepperHeader
        step={step}
        onStepChange={setStep}
        stepComplete={{
          1: methodsComplete,
          2: watchlistsComplete,
          3: reviewComplete,
        }}
      />

      <div
        className="rounded-2xl border border-[var(--desk-border)] bg-[var(--desk-panel)] p-4 sm:p-6"
        aria-live="polite"
      >
        {step === 1 ? (
          <MethodsStep
            channels={channels}
            onToggle={toggleChannel}
            methodAvailable={methodAvailable}
            methodReady={methodReady}
            pushAvailable={pushAvailable}
            webPush={webPush}
            onPushSubscribed={() =>
              setChannels((prev) =>
                prev.push ? prev : { ...prev, push: true },
              )
            }
            telegramConfigured={telegramConfigured}
            telegramBotHandle={telegramBotHandle}
            telegramBotName={telegramBotName}
            telegramLinked={telegramLinked}
            telegramHealth={telegramHealth}
            telegramHealthDetail={telegramHealthDetail}
            linkingTelegram={linkingTelegram}
            onConnectTelegram={() => void connectTelegram()}
            onDisconnectTelegram={() => void disconnectTelegram()}
            onRecheckTelegram={() => void refreshTelegramHealth()}
            emailConfigured={emailConfigured}
            sessionEmail={sessionEmail}
          />
        ) : null}

        {step === 2 ? (
          <WatchlistsStep
            savedWatchlists={savedWatchlists}
            selectedWatchlistIds={selectedWatchlistIds}
            onToggle={toggleWatchlist}
            enabledCount={enabledCount}
          />
        ) : null}

        {step === 3 ? (
          <ReviewStep
            channels={channels}
            selectedWatchlistIds={selectedWatchlistIds}
            savedWatchlists={savedWatchlists}
            methodReady={methodReady}
            rules={rules}
            telegramLinked={telegramLinked}
            sessionEmail={sessionEmail}
            saving={saving}
            testing={testing}
            canSave={canSave()}
            onSave={() => void saveSettings()}
            onTest={() => void testEnabled()}
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={step === 1}
          onClick={() => setStep((s) => (s > 1 ? ((s - 1) as StepId) : s))}
          className="btn-press gap-1.5 border-[var(--desk-border-strong)]"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Back
        </Button>
        {step < 3 ? (
          <Button
            type="button"
            onClick={() => {
              if (step === 1 && !canGoToWatchlists()) return;
              if (step === 2 && !canGoToReview()) {
                toast.error(
                  "Pick at least one watchlist, or turn methods off.",
                );
                return;
              }
              setStep((s) => (s < 3 ? ((s + 1) as StepId) : s));
            }}
            className="btn-press gap-1.5 bg-[var(--desk-live)] text-[var(--desk-accent-fg)] hover:brightness-110"
          >
            Continue
            <ArrowRight className="size-3.5" aria-hidden />
          </Button>
        ) : (
          <Button
            type="button"
            disabled={saving || !canSave()}
            onClick={() => void saveSettings()}
            className="btn-press gap-1.5 bg-[var(--desk-live)] text-[var(--desk-accent-fg)] hover:brightness-110"
          >
            {saving ? "Saving…" : "Save notifications"}
          </Button>
        )}
      </div>
    </div>
  );
}

const NOTIFICATION_CHANNEL_IDS: NotificationChannel[] = [
  "push",
  "telegram",
  "email",
];

function StepperHeader({
  step,
  onStepChange,
  stepComplete,
}: {
  step: StepId;
  onStepChange: (s: StepId) => void;
  stepComplete: Record<StepId, boolean>;
}) {
  return (
    <nav aria-label="Notification setup steps" className="w-full">
      <ol className="grid grid-cols-3 gap-2 sm:gap-3">
        {STEPS.map((s) => {
          const active = s.id === step;
          // Checkmarks reflect real setup, not merely visiting the step.
          const complete = stepComplete[s.id];
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onStepChange(s.id)}
                className={cn(
                  "btn-press flex w-full flex-col gap-1 rounded-xl border px-3 py-3 text-left transition-colors",
                  active
                    ? "border-[var(--desk-live)] bg-[color-mix(in_srgb,var(--desk-live)_10%,transparent)]"
                    : "border-[var(--desk-border)] bg-[var(--desk-header)]/40 hover:bg-[var(--desk-overlay-soft)]",
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "grid size-6 place-items-center rounded-full font-mono text-[0.65rem] font-bold",
                      active || complete
                        ? "bg-[var(--desk-live)] text-[var(--desk-accent-fg)]"
                        : "border border-[var(--desk-border-strong)] text-[var(--desk-text-dim)]",
                    )}
                  >
                    {complete ? (
                      <Check className="size-3.5" aria-hidden />
                    ) : (
                      s.id
                    )}
                  </span>
                  <span className="text-sm font-semibold text-[var(--desk-text)]">
                    {s.label}
                  </span>
                </span>
                <span className="pl-8 text-[0.7rem] text-[var(--desk-text-muted)]">
                  {s.blurb}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function MethodsStep(props: {
  channels: NotificationChannelsState;
  onToggle: (id: NotificationChannel) => void;
  methodAvailable: (id: NotificationChannel) => boolean;
  methodReady: (id: NotificationChannel) => boolean;
  pushAvailable: boolean;
  webPush: ReturnType<typeof useWebPush>;
  onPushSubscribed: () => void;
  telegramConfigured: boolean;
  telegramBotHandle: string | null;
  telegramBotName: string | null;
  telegramLinked: TelegramLinked | null;
  telegramHealth: TelegramHealthStatus;
  telegramHealthDetail: string | null;
  linkingTelegram: boolean;
  onConnectTelegram: () => void;
  onDisconnectTelegram: () => void;
  onRecheckTelegram: () => void;
  emailConfigured: boolean;
  sessionEmail: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold text-[var(--desk-text)]">
          How should we reach you?
        </h2>
        <p className="mt-1 text-sm text-[var(--desk-text-muted)]">
          Turn on one or more methods. Setup stays on this step — nothing
          remounts when you continue.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {METHOD_META.map(({ id, label, blurb, Icon }) => {
          const on = props.channels[id];
          const available = props.methodAvailable(id);
          const ready = props.methodReady(id);
          const telegramUnreachable =
            id === "telegram" && props.telegramHealth === "unreachable";
          // Email needs no recipient UI when ready — only show setup errors.
          const showSetup =
            available && (id === "email" ? !ready : on || !ready);
          return (
            <div
              key={id}
              className={cn(
                "rounded-xl border transition-colors",
                on
                  ? "border-[color-mix(in_srgb,var(--desk-live)_45%,transparent)] bg-[color-mix(in_srgb,var(--desk-live)_06%,transparent)]"
                  : "border-[var(--desk-border)] bg-[var(--desk-header)]/40",
                !available && "opacity-60",
              )}
            >
              <div className="flex items-start gap-3 px-4 py-3.5">
                <span
                  className={cn(
                    "mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border",
                    id === "telegram"
                      ? "border-[var(--desk-border-strong)] bg-[var(--desk-overlay)]"
                      : on
                        ? "border-[var(--desk-live)] bg-[var(--desk-live)] text-[var(--desk-accent-fg)]"
                        : "border-[var(--desk-border-strong)] text-[var(--desk-text-muted)]",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--desk-text)]">
                      {label}
                    </p>
                    {!available ? (
                      <span className="font-mono text-[0.6rem] tracking-wide text-[var(--desk-text-dim)] uppercase">
                        Unavailable
                      </span>
                    ) : telegramUnreachable ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[0.6rem] tracking-wide text-destructive uppercase">
                        <CircleAlert className="size-2.5" aria-hidden />
                        Unreachable
                      </span>
                    ) : ready ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[0.6rem] tracking-wide text-[var(--desk-live-status)] uppercase">
                        <CheckCircle2 className="size-2.5" aria-hidden />
                        {id === "telegram" && props.telegramHealth === "live"
                          ? "Live"
                          : "Ready"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-mono text-[0.6rem] tracking-wide text-[var(--desk-live)] uppercase">
                        <CircleAlert className="size-2.5" aria-hidden />
                        Setup needed
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--desk-text-muted)]">
                    {blurb}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  disabled={!available}
                  onClick={() => props.onToggle(id)}
                  className={cn(
                    "btn-press relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors",
                    on
                      ? "bg-[var(--desk-live)]"
                      : "bg-[var(--desk-overlay-strong)]",
                    !available && "cursor-not-allowed opacity-50",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 left-0.5 size-5 rounded-full bg-[var(--desk-accent-fg)] transition-transform",
                      on && "translate-x-5",
                    )}
                  />
                  <span className="sr-only">
                    {on ? `Disable ${label}` : `Enable ${label}`}
                  </span>
                </button>
              </div>

              {showSetup ? (
                <div className="border-t border-[var(--desk-border)] px-4 py-3">
                  {id === "push" ? (
                    <PushSetup
                      available={props.pushAvailable}
                      webPush={props.webPush}
                      onSubscribed={props.onPushSubscribed}
                    />
                  ) : null}
                  {id === "telegram" ? (
                    <TelegramSetup
                      configured={props.telegramConfigured}
                      botHandle={props.telegramBotHandle}
                      botName={props.telegramBotName}
                      linked={props.telegramLinked}
                      health={props.telegramHealth}
                      healthDetail={props.telegramHealthDetail}
                      linking={props.linkingTelegram}
                      onConnect={props.onConnectTelegram}
                      onDisconnect={props.onDisconnectTelegram}
                      onRecheck={props.onRecheckTelegram}
                    />
                  ) : null}
                  {id === "email" ? (
                    <EmailSetup
                      configured={props.emailConfigured}
                      sessionEmail={props.sessionEmail}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type PushProbeOutcome = "unknown" | "seen" | "missed";

function PushSetup({
  available,
  webPush,
  onSubscribed,
}: {
  available: boolean;
  webPush: ReturnType<typeof useWebPush>;
  onSubscribed: () => void;
}) {
  const [probing, setProbing] = useState(false);
  const [probeAsked, setProbeAsked] = useState(false);
  const [probeOutcome, setProbeOutcome] = useState<PushProbeOutcome>("unknown");

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const platformHint =
    typeof navigator !== "undefined" ? navigator.platform || "" : "";
  const platform = detectPushPlatform(ua, platformHint);
  const browser = detectPushBrowser(ua);

  async function runProbe() {
    setProbing(true);
    setProbeAsked(false);
    setProbeOutcome("unknown");
    try {
      const result = await webPush.showProbe();
      if (!result.ok) {
        toast.error(result.detail);
        return;
      }
      setProbeAsked(true);
      toast.message("Look for a system banner (not inside this page).");
    } finally {
      setProbing(false);
    }
  }

  if (!available) {
    return (
      <p className="text-xs text-[var(--desk-text-muted)]">
        Push isn’t configured on this deployment.
      </p>
    );
  }

  if (webPush.status === "unsupported") {
    return (
      <p className="text-xs text-[var(--desk-text-muted)]">
        This browser can’t receive push. Use Chrome or Edge on desktop.
      </p>
    );
  }

  if (webPush.status === "denied") {
    return (
      <div className="flex flex-col gap-2">
        <p className="inline-flex items-start gap-1.5 text-xs text-destructive">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Blocked for this site
        </p>
        <p className="text-[0.7rem] leading-snug text-[var(--desk-text-muted)]">
          {pushSiteBlockedHint(browser)}
        </p>
        {platform === "mac" || platform === "windows" ? (
          <p className="text-[0.7rem] leading-snug text-[var(--desk-text-muted)]">
            {pushOsBlockedHint(platform, browser)}
          </p>
        ) : null}
      </div>
    );
  }

  if (webPush.status === "subscribed") {
    return (
      <div className="flex flex-col gap-2.5">
        <ul className="space-y-1 text-[0.7rem] leading-snug">
          <li className="inline-flex items-center gap-1.5 text-[var(--desk-live-status)]">
            <CheckCircle2 className="size-3 shrink-0" aria-hidden />
            Site permission allowed
          </li>
          <li className="inline-flex items-center gap-1.5 text-[var(--desk-live-status)]">
            <CheckCircle2 className="size-3 shrink-0" aria-hidden />
            This browser is subscribed
          </li>
          <li
            className={cn(
              "inline-flex items-center gap-1.5",
              probeOutcome === "seen"
                ? "text-[var(--desk-live-status)]"
                : probeOutcome === "missed"
                  ? "text-destructive"
                  : "text-[var(--desk-text-muted)]",
            )}
          >
            {probeOutcome === "seen" ? (
              <CheckCircle2 className="size-3 shrink-0" aria-hidden />
            ) : probeOutcome === "missed" ? (
              <CircleAlert className="size-3 shrink-0" aria-hidden />
            ) : (
              <Bell className="size-3 shrink-0 opacity-70" aria-hidden />
            )}
            {probeOutcome === "seen"
              ? "System banners work on this device"
              : probeOutcome === "missed"
                ? "System is blocking banners"
                : "System banners not verified yet"}
          </li>
        </ul>

        <p className="text-[0.7rem] leading-snug text-[var(--desk-text-muted)]">
          Banners come from the OS (menu bar / Notification Center), not this
          page. On Mac, Chrome can be allowed here but still blocked in System
          Settings. Save on Review when ready.
        </p>

        <Button
          type="button"
          variant="outline"
          onClick={() => void runProbe()}
          disabled={probing}
          className="btn-press h-8 w-fit gap-1.5 border-[var(--desk-border)] bg-[var(--desk-overlay)] px-3 text-xs"
        >
          <Bell className="size-3.5" aria-hidden />
          {probing ? "Sending…" : "Show test banner"}
        </Button>

        {probeAsked && probeOutcome === "unknown" ? (
          <div className="flex flex-col gap-2 rounded-lg border border-[var(--desk-border)] bg-[var(--desk-overlay)]/60 px-3 py-2.5">
            <p className="text-xs text-[var(--desk-text-secondary)]">
              Did a system notification appear?
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => setProbeOutcome("seen")}
                className="btn-press h-8 gap-1.5 bg-[var(--desk-live)] px-3 text-xs text-[var(--desk-accent-fg)] hover:brightness-110"
              >
                <Check className="size-3.5" aria-hidden />
                Yes, I saw it
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setProbeOutcome("missed")}
                className="btn-press h-8 border-[var(--desk-border)] bg-transparent px-3 text-xs"
              >
                No
              </Button>
            </div>
          </div>
        ) : null}

        {probeOutcome === "missed" ? (
          <p className="text-[0.7rem] leading-snug text-destructive">
            {pushOsBlockedHint(platform, browser)}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ol className="list-decimal space-y-1 pl-4 text-[0.7rem] leading-snug text-[var(--desk-text-muted)]">
        <li>Click Enable and choose Allow when the browser asks.</li>
        <li>
          {platform === "mac"
            ? "On Mac: System Settings → Notifications → your browser → Allow."
            : platform === "windows"
              ? "On Windows: Settings → System → Notifications → allow your browser."
              : "Allow this browser in system notification settings if banners don’t appear."}
        </li>
        <li>
          Then use “Show test banner” to confirm the OS isn’t blocking them.
        </li>
      </ol>
      <Button
        type="button"
        onClick={() => {
          void (async () => {
            const ok = await webPush.subscribe();
            if (!ok) return;
            onSubscribed();
            // Immediately prove OS delivery — Chrome Allow ≠ macOS Allow.
            await runProbe();
          })();
        }}
        disabled={webPush.status === "loading"}
        className="btn-press w-fit gap-2 bg-[var(--desk-live)] text-[var(--desk-accent-fg)] hover:brightness-110"
      >
        <Bell className="size-3.5" aria-hidden />
        {webPush.status === "loading" ? "Working…" : "Enable browser push"}
      </Button>
      {webPush.error ? (
        <p className="text-xs text-destructive">{webPush.error}</p>
      ) : null}
    </div>
  );
}

function TelegramSetup({
  configured,
  botHandle,
  botName,
  linked,
  health,
  healthDetail,
  linking,
  onConnect,
  onDisconnect,
  onRecheck,
}: {
  configured: boolean;
  botHandle: string | null;
  botName: string | null;
  linked: TelegramLinked | null;
  health: TelegramHealthStatus;
  healthDetail: string | null;
  linking: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onRecheck: () => void;
}) {
  if (!configured) {
    return (
      <p className="text-xs text-[var(--desk-text-muted)]">
        Telegram bot isn’t configured on this deployment.
      </p>
    );
  }
  const displayName = botName?.trim() || "Catalyst Intel";
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium text-[var(--desk-text)]">
          {displayName}
          {botHandle ? (
            <span className="ml-2 font-mono text-xs text-[var(--desk-live)]">
              {botHandle}
            </span>
          ) : null}
        </p>
        {linked ? (
          <p className="mt-1 text-xs text-[var(--desk-text-muted)]">
            Linked chat{" "}
            <span className="font-mono text-[var(--desk-text)]">
              {linked.chatId}
            </span>
            {linked.muted ? " · muted" : ""}
          </p>
        ) : (
          <p className="mt-1 text-xs text-[var(--desk-text-muted)]">
            Opens Telegram Web with a link token — tap Start there. If the
            browser&apos;s Start Bot button does nothing, use Open in Web.
          </p>
        )}
        {linked && health === "checking" ? (
          <p className="mt-1.5 text-xs text-[var(--desk-text-dim)]">
            Checking connection…
          </p>
        ) : null}
        {linked && health === "live" ? (
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-[var(--desk-live-status)]">
            <CheckCircle2 className="size-3.5" aria-hidden />
            Connection live — bot can reach this chat
          </p>
        ) : null}
        {linked && health === "unreachable" ? (
          <p className="mt-1.5 text-xs text-destructive">
            Can&apos;t reach this chat
            {healthDetail
              ? ` — ${toUserFacingMessage(healthDetail, "connection failed")}`
              : ""}
            . Open the bot and tap Start, or Disconnect &amp; reconnect.
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {linked ? (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={onRecheck}
              className="btn-press gap-2 border-[var(--desk-border-strong)]"
            >
              Recheck
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onDisconnect}
              className="btn-press gap-2 border-[var(--desk-border-strong)]"
            >
              Disconnect
            </Button>
          </>
        ) : (
          <Button
            type="button"
            onClick={onConnect}
            disabled={linking}
            className="btn-press gap-2 bg-[var(--desk-live)] text-[var(--desk-accent-fg)] hover:brightness-110"
          >
            <TelegramIcon className="size-3.5" />
            {linking ? "Waiting for link…" : "Connect Telegram"}
          </Button>
        )}
      </div>
    </div>
  );
}

function EmailSetup({
  configured,
  sessionEmail,
}: {
  configured: boolean;
  sessionEmail: string;
}) {
  if (!configured) {
    return (
      <p className="text-xs text-[var(--desk-text-muted)]">
        Email delivery isn’t configured on this deployment.
      </p>
    );
  }
  if (!sessionEmail) {
    return (
      <p className="text-xs text-[var(--desk-text-muted)]">
        Sign in with an account that has a verified email.
      </p>
    );
  }
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[var(--desk-text-secondary)]">
        Delivers to
      </span>
      <Input
        value={sessionEmail}
        readOnly
        tabIndex={-1}
        aria-readonly="true"
        type="email"
        className="h-10 cursor-default border-[var(--desk-border)] bg-[var(--desk-overlay)] font-mono text-xs text-[var(--desk-text-dim)] shadow-none focus-visible:border-[var(--desk-border)] focus-visible:ring-0"
      />
      <span className="inline-flex items-center gap-1.5 text-[0.7rem] text-[var(--desk-live-status)]">
        <CheckCircle2 className="size-3" aria-hidden />
        Recipient locked to your account email
      </span>
      <span className="text-[0.7rem] leading-snug text-[var(--desk-text-muted)]">
        First alerts often land in Spam or Promotions — mark as not spam so
        later ones reach your inbox.
      </span>
    </label>
  );
}

function WatchlistsStep({
  savedWatchlists,
  selectedWatchlistIds,
  onToggle,
  enabledCount,
}: {
  savedWatchlists: SavedWatchlistOption[];
  selectedWatchlistIds: number[];
  onToggle: (id: number) => void;
  enabledCount: number;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--desk-text)]">
            Which watchlists should notify you?
          </h2>
          <p className="mt-1 max-w-xl text-sm text-[var(--desk-text-muted)]">
            Matching catalysts on these lists fire to every method you enabled.
            {enabledCount === 0
              ? " You can pick lists now and turn methods on later."
              : null}
          </p>
        </div>
        <Link
          href="/watchlist"
          className="btn-press inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-3 text-sm text-[var(--desk-text)] hover:bg-[var(--desk-overlay-strong)]"
        >
          <Plus className="size-3.5" aria-hidden />
          Create watchlist
        </Link>
      </div>

      {savedWatchlists.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--desk-border-strong)] px-4 py-8 text-center">
          <List className="mx-auto size-6 text-[var(--desk-text-dim)]" />
          <p className="mt-3 text-sm font-medium text-[var(--desk-text)]">
            No watchlists yet
          </p>
          <p className="mt-1 text-xs text-[var(--desk-text-muted)]">
            Create one on the Watchlists page, then come back to attach it.
          </p>
          <Link
            href="/watchlist"
            className="btn-press mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--desk-live)] px-3 text-sm font-medium text-[var(--desk-accent-fg)] hover:brightness-110"
          >
            Go to Watchlists
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {savedWatchlists.map((w) => {
            const selected = selectedWatchlistIds.includes(w.id);
            return (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={() => onToggle(w.id)}
                  className={cn(
                    "btn-press flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
                    selected
                      ? "border-[color-mix(in_srgb,var(--desk-live)_45%,transparent)] bg-[color-mix(in_srgb,var(--desk-live)_10%,transparent)]"
                      : "border-[var(--desk-border)] bg-[var(--desk-header)]/40 hover:bg-[var(--desk-overlay-soft)]",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border",
                      selected
                        ? "border-[var(--desk-live)] bg-[var(--desk-live)] text-[var(--desk-accent-fg)]"
                        : "border-[var(--desk-border-strong)]",
                    )}
                  >
                    {selected ? <Check className="size-3" aria-hidden /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[var(--desk-text)]">
                      {w.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--desk-text-muted)]">
                      {criteriaSummary(w.criteria) || "Open criteria"}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ReviewStep({
  channels,
  selectedWatchlistIds,
  savedWatchlists,
  methodReady,
  rules,
  telegramLinked,
  sessionEmail,
  saving,
  testing,
  canSave,
  onSave,
  onTest,
}: {
  channels: NotificationChannelsState;
  selectedWatchlistIds: number[];
  savedWatchlists: SavedWatchlistOption[];
  methodReady: (id: NotificationChannel) => boolean;
  rules: AlertRuleRow[];
  telegramLinked: TelegramLinked | null;
  sessionEmail: string;
  saving: boolean;
  testing: boolean;
  canSave: boolean;
  onSave: () => void;
  onTest: () => void;
}) {
  const enabledMethods = METHOD_META.filter((m) => channels[m.id]);
  const lists = savedWatchlists.filter((w) =>
    selectedWatchlistIds.includes(w.id),
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold text-[var(--desk-text)]">
          Review & save
        </h2>
        <p className="mt-1 text-sm text-[var(--desk-text-muted)]">
          Matching catalysts on your selected watchlists notify every method
          that’s on.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--desk-border)] bg-[var(--desk-header)]/40 px-4 py-3">
          <p className="font-mono text-[0.65rem] tracking-[0.16em] text-[var(--desk-text-dim)] uppercase">
            Methods
          </p>
          {enabledMethods.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--desk-text-muted)]">
              None — notifications paused after save.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {enabledMethods.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-2 text-sm text-[var(--desk-text)]"
                >
                  <span className="inline-flex items-center gap-2">
                    <m.Icon className="size-3.5 text-[var(--desk-live)]" />
                    {m.label}
                  </span>
                  {methodReady(m.id) ? (
                    <span className="font-mono text-[0.6rem] text-[var(--desk-live-status)] uppercase">
                      Ready
                    </span>
                  ) : (
                    <span className="font-mono text-[0.6rem] text-[var(--desk-live)] uppercase">
                      Setup
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {channels.email && sessionEmail ? (
            <div className="mt-2 space-y-1">
              <p className="font-mono text-[0.7rem] text-[var(--desk-text-dim)]">
                {sessionEmail}
              </p>
              <p className="text-[0.7rem] leading-snug text-[var(--desk-text-muted)]">
                Check Spam/Promotions if the first alert doesn’t show up.
              </p>
            </div>
          ) : null}
          {channels.telegram && telegramLinked ? (
            <p className="mt-2 font-mono text-[0.7rem] text-[var(--desk-text-dim)]">
              Chat {telegramLinked.chatId}
            </p>
          ) : null}
        </div>

        <div className="rounded-xl border border-[var(--desk-border)] bg-[var(--desk-header)]/40 px-4 py-3">
          <p className="font-mono text-[0.65rem] tracking-[0.16em] text-[var(--desk-text-dim)] uppercase">
            Watchlists
          </p>
          {lists.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--desk-text-muted)]">
              None selected.
            </p>
          ) : (
            <ul className="mt-2 space-y-1">
              {lists.map((w) => (
                <li key={w.id} className="text-sm text-[var(--desk-text)]">
                  {w.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={saving || !canSave}
          onClick={onSave}
          className="btn-press gap-1.5 bg-[var(--desk-live)] text-[var(--desk-accent-fg)] hover:brightness-110"
        >
          {saving ? "Saving…" : "Save notifications"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={testing || enabledMethods.length === 0}
          onClick={onTest}
          className="btn-press gap-1.5 border-[var(--desk-border-strong)]"
        >
          <FlaskConical className="size-3.5" aria-hidden />
          {testing ? "Testing…" : "Test fire"}
        </Button>
      </div>

      {rules.some((r) => r.enabled) ? (
        <p className="text-[0.7rem] text-[var(--desk-text-dim)]">
          Active delivery rows:{" "}
          {rules
            .filter((r) => r.enabled)
            .map((r) => r.channel)
            .join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
