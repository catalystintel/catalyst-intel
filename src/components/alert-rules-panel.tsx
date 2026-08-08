"use client";

import Link from "next/link";
import { useEffect, useState, type ComponentType } from "react";
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
    blurb: "Browser notifications — even with the tab closed",
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
  const [linkingTelegram, setLinkingTelegram] = useState(false);
  const [telegramChatOverride, setTelegramChatOverride] = useState("");

  const webPush = useWebPush(pushPublicKey);

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
  }, []);

  function methodAvailable(id: NotificationChannel): boolean {
    if (id === "push") return pushAvailable;
    if (id === "telegram") return telegramConfigured;
    return emailConfigured && Boolean(sessionEmail);
  }

  function methodReady(id: NotificationChannel): boolean {
    if (!methodAvailable(id)) return false;
    if (id === "push") return webPush.status === "subscribed";
    if (id === "telegram") return Boolean(telegramLinked);
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
          ...(telegramChatOverride.trim()
            ? { telegramChatId: telegramChatOverride.trim() }
            : {}),
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
      const results = Array.isArray(data.results) ? data.results : [];
      const ok = results.filter(
        (r: { ok?: boolean; skipped?: boolean }) => r.ok && !r.skipped,
      ).length;
      const failed = results.filter(
        (r: { ok?: boolean; skipped?: boolean }) => !r.ok && !r.skipped,
      ).length;
      if (failed > 0) {
        toast.error(`Test: ${failed} failed, ${ok} delivered.`);
      } else if (ok === 0) {
        toast.message("Nothing delivered — enable a method and save first.");
      } else {
        toast.success(`Test fired — ${ok} delivery(ies).`);
      }
    } catch (err) {
      toast.error(toUserFacingMessage(err, "Test failed."));
    } finally {
      setTesting(false);
    }
  }

  if (!loaded) return <AlertRulesListSkeleton />;

  return (
    <div className="flex flex-col gap-6">
      <StepperHeader step={step} onStepChange={setStep} />

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
            telegramConfigured={telegramConfigured}
            telegramBotHandle={telegramBotHandle}
            telegramBotName={telegramBotName}
            telegramLinked={telegramLinked}
            linkingTelegram={linkingTelegram}
            onConnectTelegram={() => void connectTelegram()}
            onDisconnectTelegram={() => void disconnectTelegram()}
            telegramChatOverride={telegramChatOverride}
            setTelegramChatOverride={setTelegramChatOverride}
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
            sessionEmail={sessionEmail}
            telegramLinked={telegramLinked}
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
}: {
  step: StepId;
  onStepChange: (s: StepId) => void;
}) {
  return (
    <nav aria-label="Notification setup steps" className="w-full">
      <ol className="grid grid-cols-3 gap-2 sm:gap-3">
        {STEPS.map((s) => {
          const active = s.id === step;
          const done = s.id < step;
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
                      active || done
                        ? "bg-[var(--desk-live)] text-[var(--desk-accent-fg)]"
                        : "border border-[var(--desk-border-strong)] text-[var(--desk-text-dim)]",
                    )}
                  >
                    {done ? <Check className="size-3.5" aria-hidden /> : s.id}
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
  telegramConfigured: boolean;
  telegramBotHandle: string | null;
  telegramBotName: string | null;
  telegramLinked: TelegramLinked | null;
  linkingTelegram: boolean;
  onConnectTelegram: () => void;
  onDisconnectTelegram: () => void;
  telegramChatOverride: string;
  setTelegramChatOverride: (v: string) => void;
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
                    ) : ready ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[0.6rem] tracking-wide text-[var(--desk-live-status)] uppercase">
                        <CheckCircle2 className="size-2.5" aria-hidden />
                        Ready
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

              {(on || !ready) && available ? (
                <div className="border-t border-[var(--desk-border)] px-4 py-3">
                  {id === "push" ? (
                    <PushSetup
                      available={props.pushAvailable}
                      webPush={props.webPush}
                    />
                  ) : null}
                  {id === "telegram" ? (
                    <TelegramSetup
                      configured={props.telegramConfigured}
                      botHandle={props.telegramBotHandle}
                      botName={props.telegramBotName}
                      linked={props.telegramLinked}
                      linking={props.linkingTelegram}
                      onConnect={props.onConnectTelegram}
                      onDisconnect={props.onDisconnectTelegram}
                      chatOverride={props.telegramChatOverride}
                      setChatOverride={props.setTelegramChatOverride}
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

function PushSetup({
  available,
  webPush,
}: {
  available: boolean;
  webPush: ReturnType<typeof useWebPush>;
}) {
  if (!available) {
    return (
      <p className="text-xs text-[var(--desk-text-muted)]">
        Push isn’t configured on this deployment.
      </p>
    );
  }
  if (webPush.status === "subscribed") {
    return (
      <p className="inline-flex items-center gap-1.5 text-xs text-[var(--desk-live-status)]">
        <CheckCircle2 className="size-3.5" aria-hidden />
        This browser is subscribed.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-[var(--desk-text-muted)]">
        Allow notifications in this browser so push can deliver.
      </p>
      <Button
        type="button"
        onClick={() => void webPush.subscribe()}
        disabled={webPush.status === "loading" || webPush.status === "denied"}
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
  linking,
  onConnect,
  onDisconnect,
  chatOverride,
  setChatOverride,
}: {
  configured: boolean;
  botHandle: string | null;
  botName: string | null;
  linked: TelegramLinked | null;
  linking: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  chatOverride: string;
  setChatOverride: (v: string) => void;
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
      </div>
      <div className="flex flex-wrap gap-2">
        {linked ? (
          <Button
            type="button"
            variant="outline"
            onClick={onDisconnect}
            className="btn-press gap-2 border-[var(--desk-border-strong)]"
          >
            Disconnect
          </Button>
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
      <label className="flex flex-col gap-1">
        <span className="text-[0.7rem] text-[var(--desk-text-dim)]">
          Chat ID override (optional)
        </span>
        <Input
          value={chatOverride}
          onChange={(e) => setChatOverride(e.target.value)}
          placeholder={linked ? `Linked ${linked.chatId}` : "e.g. 123456789"}
          inputMode="numeric"
          className="h-9 border-[var(--desk-border)] bg-[var(--desk-overlay)] font-mono text-xs"
        />
      </label>
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
  sessionEmail,
  telegramLinked,
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
  sessionEmail: string;
  telegramLinked: TelegramLinked | null;
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
