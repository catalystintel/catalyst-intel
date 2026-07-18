import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  supabaseUserId: text("supabase_user_id").notNull().unique(),
  email: text("email").notNull().unique(),
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
  marketCap: integer("market_cap"),
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

export const catalysts = sqliteTable("catalysts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").references(() => companies.id),
  ticker: text("ticker"),
  type: text("type").notNull(),
  title: text("title").notNull(),
  timestamp: text("timestamp").notNull(),
  rawSourceId: integer("raw_source_id")
    .notNull()
    .references(() => rawSources.id),
  // Filled in by the later AI processing phase - null until then.
  summary: text("summary"),
  impactScore: integer("impact_score"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});
