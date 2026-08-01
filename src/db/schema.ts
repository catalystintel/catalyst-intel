import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  supabaseUserId: text("supabase_user_id").notNull().unique(),
  email: text("email").notNull().unique(),
  // User-chosen override; falls back to the Google OAuth name when null.
  displayName: text("display_name"),
  // Cache of admin allowlist status (JWT email). Source of truth: ADMIN_EMAILS / defaults.
  role: text("role", { enum: ["user", "admin"] })
    .notNull()
    .default("user"),
  subscription: text("subscription", { enum: ["free", "pro"] })
    .notNull()
    .default("free"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const companies = sqliteTable("companies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  symbol: text("symbol").unique(),
  sector: text("sector"),
  // Millions of USD; from vendor profile enrichment (e.g. Finnhub profile2).
  marketCap: integer("market_cap"),
  // Primary listing venue, e.g. "NASDAQ" / "NYSE" (vendor profile enrichment).
  exchange: text("exchange"),
  logoUrl: text("logo_url"),
  // Last time sector/marketCap/exchange/logoUrl were refreshed from a vendor.
  enrichedAt: text("enriched_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

// Raw payloads exactly as received from a data vendor, kept for audit/reprocessing.
export const rawSources = sqliteTable("raw_sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  provider: text("provider").notNull(),
  // Stable identifier used for de-duplication (e.g. SEC accession number or entry URL).
  externalId: text("external_id").notNull().unique(),
  url: text("url"),
  rawContent: text("raw_content", { mode: "json" }).notNull(),
  fetchedAt: text("fetched_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export type AlertSession = "AH" | "PM" | "RTH" | "any";

export const SYMBOL_SOURCE_VALUES = [
  "vendor",
  "sec-cik-map",
  "sec-name-exact",
  "sec-name-fuzzy",
  "finnhub-search",
  "unresolved",
] as const;
export type SymbolSource = (typeof SYMBOL_SOURCE_VALUES)[number];

export const SENTIMENT_VALUES = ["bullish", "bearish", "neutral"] as const;
export type SentimentLean = (typeof SENTIMENT_VALUES)[number];

export const AI_LEAN_VALUES = [
  "bullish",
  "bearish",
  "neutral",
  "uncertain",
] as const;
export type AiLean = (typeof AI_LEAN_VALUES)[number];

/** Session-time price snapshot captured alongside historicalImpact enrichment. */
export interface SessionContext {
  session: AlertSession;
  provider: "polygon";
  date: string;
  price: number | null;
  changePercent: number | null;
  asOf: string;
}

export const catalysts = sqliteTable("catalysts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").references(() => companies.id),
  symbol: text("symbol"),
  // Denormalized issuer name so rows without a symbol match still read clearly.
  companyName: text("company_name"),
  type: text("type").notNull(),
  title: text("title").notNull(),
  // Short trader-facing event label derived from the filing's primary 8-K item.
  headline: text("headline"),
  // Grouping key (see EventCategoryKey) used for feed filtering and color.
  eventCategory: text("event_category"),
  // Finer grain within eventCategory (e.g. "halt_resumed", "form4_purchase").
  subcategory: text("subcategory"),
  // All parsed 8-K items on the filing: [{ code, label, category }].
  itemCodes: text("item_codes", { mode: "json" }),
  timestamp: text("timestamp").notNull(),
  rawSourceId: integer("raw_source_id")
    .notNull()
    .references(() => rawSources.id),
  // Filled in by the later AI processing phase - null until then.
  summary: text("summary"),
  // Rule-based materiality (0–100); see materiality.ts computeMateriality.
  impactScore: integer("impact_score"),
  // Ingest confidence 0–100 (feed quality / parser certainty).
  confidence: integer("confidence"),
  // Free-form tags for desk filtering, e.g. ["fda", "pdufa"].
  tags: text("tags", { mode: "json" }),
  // Optional price-move enrichment from Polygon (or notes as JSON/text).
  historicalImpact: text("historical_impact", { mode: "json" }),
  // How `symbol` was resolved — explainability for entity resolution (see symbol-resolver.ts).
  symbolSource: text("symbol_source", { enum: SYMBOL_SOURCE_VALUES }),
  // Directional lean from vendor-provided sentiment (e.g. Polygon news insights).
  sentiment: text("sentiment", { enum: SENTIMENT_VALUES }),
  sentimentReasoning: text("sentiment_reasoning"),
  // Plain-language reasons behind impactScore v2 (category, item, liquidity, session, etc.).
  materialityReasons: text("materiality_reasons", { mode: "json" }),
  // Session-time price/% snapshot; see SessionContext.
  sessionContext: text("session_context", { mode: "json" }),
  // Grounded on-demand LLM triage (OpenRouter) — 2–3 short bullets. Null until first analyze.
  aiBullets: text("ai_bullets", { mode: "json" }),
  aiLean: text("ai_lean", { enum: AI_LEAN_VALUES }),
  aiUncertain: integer("ai_uncertain", { mode: "boolean" }),
  // Cross-source event merge (same symbol, near-simultaneous) — see cluster-events.ts.
  clusterId: integer("cluster_id").references(() => eventClusters.id),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

/**
 * Groups catalysts from different sources/symbols that fire within a short
 * window (e.g. halt + 8-K + wire on the same name) into one decision object.
 * Only materialized when 2+ catalysts actually merge — see cluster-events.ts.
 */
export const eventClusters = sqliteTable("event_clusters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  symbol: text("symbol").notNull(),
  category: text("category"),
  windowStart: text("window_start").notNull(),
  windowEnd: text("window_end").notNull(),
  memberCount: integer("member_count").notNull().default(1),
  // Highest-materiality member; the row the UI should render as the headline.
  primaryCatalystId: integer("primary_catalyst_id"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

/** Per-user symbols the desk cares about (JTBD quiet-mode filter). */
export const watchlistEntries = sqliteTable("watchlist_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  symbol: text("symbol").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

/**
 * Saved feed-filter combinations ("smart" watchlists) — a user can have many.
 * Unlike `watchlist_entries` (a flat symbol list for quiet mode), a row here
 * freezes an arbitrary filter combo (symbols + categories + forms + tags +
 * sources + free-text) so it can be named, previewed, and re-applied to the
 * live tape — and, next phase, referenced from an alert rule's conditions.
 */
export interface WatchlistCriteria {
  /** Exact symbol matches (uppercase). */
  symbols?: string[];
  /** EventCategoryKey values. */
  categories?: string[];
  /** FeedFormFilter values (8-K, 424B, 4, S-3, 13D, 13G, other). */
  forms?: string[];
  /** Auto/vendor tags (lowercase), e.g. "category:earnings", "fda". */
  tags?: string[];
  /** Vendor provider ids (local-dev facet; harmless no-op elsewhere). */
  sources?: string[];
  /** Free-text search over symbol/company/title/headline. */
  q?: string;
}

export const watchlists = sqliteTable("watchlists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  criteria: text("criteria", { mode: "json" }).notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

/**
 * Playbook: which event categories count as signal when the tape is quiet.
 * One row per user; `categories` is a JSON string array of EventCategoryKey.
 */
export const playbookSettings = sqliteTable("playbook_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => users.id),
  categories: text("categories", { mode: "json" }).notNull(),
  /** When true, Live feed only shows watchlist + playbook-matching rows. */
  quietMode: integer("quiet_mode", { mode: "boolean" })
    .notNull()
    .default(false),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

/**
 * Admin-only personal feed source visibility. One row per admin user;
 * `enabled_sources` is a JSON array of CatalystSourceId. Missing row =
 * all feed-row sources on. Does not affect ingest / other users.
 */
export const userSourceSettings = sqliteTable("user_source_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => users.id),
  enabledSources: text("enabled_sources", { mode: "json" }).notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export type AlertChannel = "email" | "webhook" | "push" | "telegram";

export interface AlertRuleConditions {
  /** Empty / omitted = any category. */
  categories?: string[];
  /** Minimum rule-based impact score (0–100). */
  minImpact?: number;
  /** Session filter for AH/PM bombs; default any. */
  sessions?: AlertSession[];
  /** When true, only fire for catalysts whose symbol is on the user's watchlist. */
  watchlistOnly?: boolean;
  /**
   * Any-match against the catalyst's auto/vendor tags (see `deriveAutoTags`
   * in ingest-pipeline.ts), e.g. ["category:regulatory", "fda"]. Empty /
   * omitted = any tags.
   */
  tags?: string[];
}

/**
 * Per-user tape dismissals (JTBD Act/Dismiss). Survives device changes —
 * localStorage was only a stopgap until this table shipped.
 */
export const dismissedCatalysts = sqliteTable("dismissed_catalysts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  catalystId: integer("catalyst_id")
    .notNull()
    .references(() => catalysts.id),
  dismissedAt: text("dismissed_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

/** User-defined delivery rules (email / webhook / push / Telegram). */
export const alertRules = sqliteTable("alert_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  channel: text("channel", {
    enum: ["email", "webhook", "push", "telegram"],
  }).notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  webhookUrl: text("webhook_url"),
  emailTo: text("email_to"),
  // Telegram chat id the user gets by messaging the bot; see lib/telegram.
  telegramChatId: text("telegram_chat_id"),
  conditions: text("conditions", { mode: "json" }).notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

/**
 * Browser Web Push subscriptions (one row per browser/device a user has
 * granted notification permission on). Free — no FCM/APNs account needed,
 * delivers even when the tab/browser is closed. See lib/push.
 */
export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

/**
 * One row per multi-source `/api/admin/fetch/all` orchestration.
 * Written after each cron / admin trigger so ops can audit cadence and results.
 */
export const ingestionRuns = sqliteTable("ingestion_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ranAt: text("ran_at").notNull(),
  /** Who triggered the orchestrator. */
  trigger: text("trigger", { enum: ["cron", "admin"] }).notNull(),
  /** Aggregate outcome derived from per-source results. */
  status: text("status", { enum: ["ok", "partial", "failed"] }).notNull(),
  fetched: integer("fetched").notNull().default(0),
  inserted: integer("inserted").notNull().default(0),
  skipped: integer("skipped").notNull().default(0),
  errors: integer("errors").notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(0),
  /** Compact per-source results for drill-down in Admin. */
  sourcesJson: text("sources_json", { mode: "json" }).notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

/**
 * Per-vendor ingest watermark. `last_fetched_at` advances only on success so
 * a 429/error leaves the cursor behind and the next tick widens the window
 * (see `resolvePolygonNewsWindow` / FETCH-ORDER.md).
 */
export const vendorFetchState = sqliteTable("vendor_fetch_state", {
  /** Matches `CatalystSourceId` (e.g. polygon-news, sec-edgar). */
  sourceId: text("source_id").primaryKey(),
  /** Watermark used as the next catch-up lower bound (ISO). */
  lastFetchedAt: text("last_fetched_at"),
  lastAttemptAt: text("last_attempt_at").notNull(),
  lastStatus: text("last_status", {
    enum: ["ok", "error", "skipped", "rate_limited"],
  }).notNull(),
  lastMessage: text("last_message"),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

/**
 * Audit trail + dedup guard for auto-fired alerts (one row per rule×catalyst
 * delivery attempt). Lets the ingest pipeline evaluate rules on every fetch
 * without re-notifying the same catalyst twice — see alerts/auto-fire.ts.
 */
export const alertDeliveries = sqliteTable("alert_deliveries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  alertRuleId: integer("alert_rule_id")
    .notNull()
    .references(() => alertRules.id),
  catalystId: integer("catalyst_id")
    .notNull()
    .references(() => catalysts.id),
  channel: text("channel", {
    enum: ["email", "webhook", "push", "telegram"],
  }).notNull(),
  status: text("status", { enum: ["sent", "failed", "skipped"] }).notNull(),
  detail: text("detail"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

/**
 * NYSE listing universe from Finnhub (`stock/symbol?exchange=US`, mic XNYS).
 * Optional last price filled when quote enrichment runs.
 */
export const nyseListings = sqliteTable("nyse_listings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  symbol: text("symbol").notNull().unique(),
  displaySymbol: text("display_symbol").notNull(),
  description: text("description"),
  mic: text("mic"),
  type: text("type"),
  currency: text("currency"),
  /** Last trade price as decimal string (e.g. "184.25"); null until quoted. */
  lastPrice: text("last_price"),
  quotedAt: text("quoted_at"),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const REPORT_WINDOW_VALUES = ["24h", "7d", "30d"] as const;
export type ReportWindow = (typeof REPORT_WINDOW_VALUES)[number];

export const REPORT_SCOPE_VALUES = ["watchlist", "all"] as const;
export type ReportScope = (typeof REPORT_SCOPE_VALUES)[number];

/**
 * User-saved catalyst digest snapshots.
 * `itemsJson` is a frozen serialization of `ReportSnapshotItem[]` so the
 * shared link never drifts with the live tape.
 */
export const savedReports = sqliteTable("saved_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  window: text("window", { enum: REPORT_WINDOW_VALUES }).notNull(),
  scope: text("scope", { enum: REPORT_SCOPE_VALUES }).notNull(),
  /** URL-safe token for public share links; unique per report. */
  shareToken: text("share_token").notNull().unique(),
  itemCount: integer("item_count").notNull().default(0),
  /** Frozen JSON snapshot of ReportSnapshotItem[]. */
  itemsJson: text("items_json", { mode: "json" }).notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});
