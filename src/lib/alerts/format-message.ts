/**
 * Shared alert copy for push / Telegram / email.
 *
 * Flow:
 *   ingest → auto-fire matches rule → format once → channel adapters send
 *
 * Trader-facing rules:
 *   1. Lead with symbol + category (scan in <2s)
 *   2. One-line what happened (headline)
 *   3. Context line: category · session
 *   4. One primary action (open on desk); proof URL secondary
 *   5. No emoji, no hype — calm desk tone
 */

import {
  CATEGORY_LABELS,
  isEventCategoryKey,
  type EventCategoryKey,
} from "@/lib/catalysts/taxonomy";
import type { AlertSession } from "@/db/schema";
import { classifySession } from "@/lib/alerts/session";

/** Minimal catalyst fields needed for alert copy (matches deliver payload). */
export interface AlertMessageCatalyst {
  id: number;
  symbol: string | null;
  headline: string | null;
  title: string;
  eventCategory: string | null;
  /** @deprecated Impact score retired — ignored in alert copy. */
  impactScore: number | null;
  timestamp: string;
  sourceUrl: string | null;
}

export const ALERT_SESSION_OPTIONS = [
  {
    value: "PM" as const,
    label: "Pre-market",
    short: "PM",
    hint: "4:00–9:30 AM ET",
  },
  {
    value: "RTH" as const,
    label: "Regular hours",
    short: "RTH",
    hint: "9:30 AM–4:00 PM ET",
  },
  {
    value: "AH" as const,
    label: "After-hours",
    short: "AH",
    hint: "4:00–8:00 PM ET",
  },
];

export type AlertSessionOptionValue =
  (typeof ALERT_SESSION_OPTIONS)[number]["value"];

const SESSION_LABELS: Record<Exclude<AlertSession, "any">, string> = {
  PM: "Pre-market",
  RTH: "Regular hours",
  AH: "After-hours",
};

export function sessionDisplayLabel(session: AlertSession): string {
  if (session === "any") return "Any session";
  return SESSION_LABELS[session] ?? session;
}

/** Human labels for a rule's session filter (for UI lists). */
export function formatSessionsForDisplay(
  sessions: AlertSession[] | undefined,
): string {
  if (!sessions || sessions.length === 0 || sessions.includes("any")) {
    return "Any session";
  }
  const ordered = ALERT_SESSION_OPTIONS.map((o) => o.value).filter((v) =>
    sessions.includes(v),
  );
  return ordered.map(sessionDisplayLabel).join(" · ");
}

/**
 * Normalize UI multi-select into stored conditions.
 * All three buckets selected → `["any"]` (same matching behavior, cleaner).
 */
export function sessionsFromSelection(
  selected: AlertSessionOptionValue[],
): AlertSession[] {
  const unique = ALERT_SESSION_OPTIONS.map((o) => o.value).filter((v) =>
    selected.includes(v),
  );
  if (unique.length === 0 || unique.length === ALERT_SESSION_OPTIONS.length) {
    return ["any"];
  }
  return unique;
}

function categoryLabel(raw: string | null): string {
  if (!raw) return "Catalyst";
  if (isEventCategoryKey(raw)) {
    return CATEGORY_LABELS[raw as EventCategoryKey];
  }
  return raw.replace(/_/g, " ");
}

function formatFiledEt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    }).format(date);
  } catch {
    return iso;
  }
}

function resolveAppOrigin(env: NodeJS.ProcessEnv = process.env): string | null {
  const configured = env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // fall through
    }
  }
  const productionHost = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (env.VERCEL_ENV === "production" && productionHost) {
    return `https://${productionHost.replace(/^https?:\/\//, "")}`;
  }
  const vercelUrl = env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/^https?:\/\//, "")}`;
  }
  return null;
}

export interface FormattedAlertMessage {
  symbol: string;
  headline: string;
  /** Email subject line */
  subject: string;
  /** Push notification title (short) */
  pushTitle: string;
  /** Push notification body (one line) */
  pushBody: string;
  /** Full plain-text body for email + Telegram */
  text: string;
  /** Deep link into the desk event page, when origin is known */
  deskUrl: string | null;
  sourceUrl: string | null;
}

/**
 * Builds professional, channel-agnostic alert copy from a catalyst.
 */
export function formatAlertMessage(
  catalyst: AlertMessageCatalyst,
  options?: { ruleName?: string; env?: NodeJS.ProcessEnv },
): FormattedAlertMessage {
  const symbol = (catalyst.symbol?.trim() || "—").toUpperCase();
  const headline = (
    catalyst.headline?.trim() ||
    catalyst.title?.trim() ||
    "New catalyst"
  ).slice(0, 200);

  const session = classifySession(catalyst.timestamp);
  const sessionLabel = session === "any" ? null : sessionDisplayLabel(session);
  const category = categoryLabel(catalyst.eventCategory);

  const contextParts = [category, sessionLabel].filter(Boolean);

  const origin = resolveAppOrigin(options?.env);
  const deskUrl = origin
    ? `${origin}/catalyst-feed/catalyst/${catalyst.id}`
    : null;
  const sourceUrl = catalyst.sourceUrl?.trim() || null;

  const lines = [
    `${symbol} · ${category}`,
    headline,
    "",
    contextParts.join(" · "),
    `Filed ${formatFiledEt(catalyst.timestamp)}`,
  ];

  if (options?.ruleName?.trim()) {
    lines.push(`Rule: ${options.ruleName.trim()}`);
  }

  lines.push("");
  if (deskUrl) {
    lines.push(`Open on desk: ${deskUrl}`);
  }
  if (sourceUrl) {
    lines.push(`Original source: ${sourceUrl}`);
  }

  const subject = `[Catalyst] ${symbol} · ${headline}`.slice(0, 120);
  const pushTitle = `${symbol} · ${category}`;
  const pushBody = headline;

  return {
    symbol,
    headline,
    subject,
    pushTitle,
    pushBody,
    text: lines.join("\n"),
    deskUrl,
    sourceUrl,
  };
}
