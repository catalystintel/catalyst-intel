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
  ticker: text("ticker").unique(),
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

export const TICKER_SOURCE_VALUES = [
  "vendor",
  "sec-cik-map",
  "sec-name-exact",
  "sec-name-fuzzy",
  "finnhub-search",
  "unresolved",
] as const;
export type TickerSource = (typeof TICKER_SOURCE_VALUES)[number];

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
  ticker: text("ticker"),
  // Denormalized issuer name so rows without a ticker match still read clearly.
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
  // How `ticker` was resolved — explainability for entity resolution (see ticker-resolver.ts).
  tickerSource: text("ticker_source", { enum: TICKER_SOURCE_VALUES }),
  // Directional lean from vendor-provided sentiment (e.g. Polygon news insights).
  sentiment: text("sentiment", { enum: SENTIMENT_VALUES }),
  sentimentReasoning: text("sentiment_reasoning"),
  // Plain-language reasons behind impactScore v2 (category, item, liquidity, session, etc.).
  materialityReasons: text("materiality_reasons", { mode: "json" }),
  // Session-time price/% snapshot; see SessionContext.
  sessionContext: text("session_context", { mode: "json" }),
  // Grounded LLM triage (Groq) — 3 short bullets, never inventing facts. Null until triaged.
  aiBullets: text("ai_bullets", { mode: "json" }),
  aiLean: text("ai_lean", { enum: AI_LEAN_VALUES }),
  aiUncertain: integer("ai_uncertain", { mode: "boolean" }),
  // Cross-source event merge (same ticker, near-simultaneous) — see cluster-events.ts.
  clusterId: integer("cluster_id").references(() => eventClusters.id),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

/**
 * Groups catalysts from different sources/tickers that fire within a short
 * window (e.g. halt + 8-K + wire on the same name) into one decision object.
 * Only materialized when 2+ catalysts actually merge — see cluster-events.ts.
 */
export const eventClusters = sqliteTable("event_clusters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticker: text("ticker").notNull(),
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

/** Per-user tickers the desk cares about (JTBD quiet-mode filter). */
export const watchlistEntries = sqliteTable("watchlist_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  ticker: text("ticker").notNull(),
  createdAt: text("created_at")
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

export type AlertChannel = "email" | "webhook" | "push";

export interface AlertRuleConditions {
  /** Empty / omitted = any category. */
  categories?: string[];
  /** Minimum rule-based impact score (0–100). */
  minImpact?: number;
  /** Session filter for AH/PM bombs; default any. */
  sessions?: AlertSession[];
}

/** User-defined delivery rules (email / webhook MVP; push stubbed). */
export const alertRules = sqliteTable("alert_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  channel: text("channel", { enum: ["email", "webhook", "push"] }).notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  webhookUrl: text("webhook_url"),
  emailTo: text("email_to"),
  conditions: text("conditions", { mode: "json" }).notNull(),
  createdAt: text("created_at")
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
  channel: text("channel", { enum: ["email", "webhook", "push"] }).notNull(),
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
