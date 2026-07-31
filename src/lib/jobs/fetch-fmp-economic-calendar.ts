/**
 * FMP Economic Calendar — optional paid/free-key source for US macro releases
 * with consensus (estimate), previous, and actuals.
 *
 * Not on the 1-min fetch/all path (quota). Hit via dedicated cron every
 * ~10 minutes: POST /api/admin/fetch/fmp-econ-calendar + x-cron-secret,
 * or `npm run cron:fmp-econ` locally.
 *
 * Soft-skips when FMP_API_KEY is unset or the plan returns 402.
 */

import { formatFomcRateDecisionTitle } from "@/lib/catalysts/catalyst-titles";
import type { MacroEventDef } from "@/lib/jobs/fetch-macro-calendar";
import {
  ingestNormalizedCatalysts,
  skippedSourceResult,
  toSourceResult,
  type NormalizedCatalyst,
  type SourceFetchResult,
} from "@/lib/jobs/ingest-pipeline";
import { getFmpApiKey } from "@/lib/jobs/vendor-env";

export const FMP_ECON_CALENDAR_PROVIDER = "fmp-econ-calendar" as const;

const FMP_ECON_URL =
  "https://financialmodelingprep.com/stable/economic-calendar";

/** Default lookahead for desk + tape ingest. */
export const FMP_ECON_HORIZON_DAYS = 45;

export interface FmpEconomicEvent {
  date: string;
  country?: string | null;
  event?: string | null;
  currency?: string | null;
  previous?: number | null;
  estimate?: number | null;
  actual?: number | null;
  change?: number | null;
  impact?: string | null;
  changePercentage?: number | null;
}

export type FmpMacroSubcategory = MacroEventDef["subcategory"] | "other";

const WHY: Record<MacroEventDef["subcategory"], string> = {
  cpi: "Primary inflation print — moves rate odds, USD, and equity risk appetite.",
  nfp: "Jobs + unemployment — Fed reaction function and growth narrative.",
  fomc: "Policy decision + statement — highest-impact scheduled US macro event.",
  ppi: "Pipeline inflation — often foreshadows CPI and sector leadership.",
};

function isoDateOnly(value: string): string {
  return value.slice(0, 10);
}

function addUtcDays(isoDay: string, days: number): string {
  const d = new Date(`${isoDay}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** UTC clock → approximate ET display (EDT −4). Good enough for desk labels. */
export function utcDateTimeToTimeEt(dateStr: string): string {
  const parsed = Date.parse(
    dateStr.includes("T") ? dateStr : dateStr.replace(" ", "T") + "Z",
  );
  if (Number.isNaN(parsed)) return "08:30";
  const etMs = parsed - 4 * 60 * 60 * 1000;
  const et = new Date(etMs);
  const hh = et.getUTCHours();
  const mm = et.getUTCMinutes();
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function classifyFmpMacroEvent(eventName: string): FmpMacroSubcategory {
  const n = eventName.toLowerCase();
  if (/\bcpi\b|consumer price/.test(n)) return "cpi";
  if (/\bppi\b|producer price/.test(n)) return "ppi";
  if (/non[- ]?farm|nonfarm|payroll|\bnfp\b|employment situation/.test(n)) {
    return "nfp";
  }
  if (
    /fomc|federal funds|fed rate|interest rate decision|fed.*decision/.test(n)
  ) {
    return "fomc";
  }
  return "other";
}

function formatNum(value: number | null | undefined): string | null {
  if (value == null || Number.isNaN(value)) return null;
  return String(value);
}

function buildSummary(row: FmpEconomicEvent): string {
  const parts = [row.event?.trim() || "Economic release"];
  const est = formatNum(row.estimate);
  const prev = formatNum(row.previous);
  const act = formatNum(row.actual);
  if (act != null) parts.push(`Actual ${act}`);
  if (est != null) parts.push(`Est ${est}`);
  if (prev != null) parts.push(`Prev ${prev}`);
  if (row.impact) parts.push(`${row.impact} impact`);
  parts.push("FMP");
  return parts.join(" · ");
}

function deskTitle(
  subcategory: MacroEventDef["subcategory"],
  eventName: string,
): string {
  if (subcategory === "fomc") return formatFomcRateDecisionTitle();
  // Prefer FMP's event label (includes YoY/MoM / period cues).
  return eventName.trim() || "US Macro";
}

/**
 * Keep High-impact US (and Medium for core desk prints).
 */
export function shouldIngestFmpEvent(row: FmpEconomicEvent): boolean {
  const country = (row.country ?? "").trim().toUpperCase();
  if (country !== "US" && country !== "USA") return false;
  const name = (row.event ?? "").trim();
  if (!name) return false;
  const impact = (row.impact ?? "").trim().toLowerCase();
  const sub = classifyFmpMacroEvent(name);
  if (impact === "high") return true;
  if (
    impact === "medium" &&
    (sub === "cpi" || sub === "nfp" || sub === "ppi" || sub === "fomc")
  ) {
    return true;
  }
  // Some FMP rows omit impact — still take core desk names.
  if (!impact && sub !== "other") return true;
  return false;
}

export function fmpRowToNormalized(
  row: FmpEconomicEvent,
): NormalizedCatalyst | null {
  if (!shouldIngestFmpEvent(row)) return null;
  const name = (row.event ?? "").trim();
  const sub = classifyFmpMacroEvent(name);
  const dateRaw = row.date?.trim();
  if (!dateRaw) return null;
  const day = isoDateOnly(dateRaw.replace(" ", "T"));
  const timestamp = dateRaw.includes("T")
    ? new Date(dateRaw.endsWith("Z") ? dateRaw : `${dateRaw}Z`).toISOString()
    : new Date(dateRaw.replace(" ", "T") + "Z").toISOString();
  if (Number.isNaN(Date.parse(timestamp))) return null;

  const subcategory = sub === "other" ? "macro" : sub;
  const title = sub === "other" ? name : deskTitle(sub, name);

  const externalId = `fmp-econ:${day}:${name.toLowerCase().replace(/\s+/g, "-").slice(0, 80)}`;

  return {
    provider: FMP_ECON_CALENDAR_PROVIDER,
    externalId,
    url: "https://site.financialmodelingprep.com/datasets/economics",
    rawContent: row,
    symbol: null,
    companyName: "US Macro",
    type: "Economics",
    title,
    headline: name,
    eventCategory: "macro",
    subcategory,
    timestamp,
    summary: buildSummary(row),
    confidence: 75,
    tags: [
      "macro",
      "economics",
      "fmp",
      sub,
      (row.impact ?? "unknown").toLowerCase(),
    ],
  };
}

/** Map ingested/core FMP rows into desk calendar shape (CPI/NFP/PPI/FOMC only). */
export function fmpRowToMacroEventDef(
  row: FmpEconomicEvent,
): MacroEventDef | null {
  if (!shouldIngestFmpEvent(row)) return null;
  const name = (row.event ?? "").trim();
  const sub = classifyFmpMacroEvent(name);
  if (sub === "other") return null;
  const dateRaw = row.date?.trim();
  if (!dateRaw) return null;
  const day = isoDateOnly(dateRaw.replace(" ", "T"));
  const timeEt = utcDateTimeToTimeEt(dateRaw);
  const est = formatNum(row.estimate);
  const prev = formatNum(row.previous);
  const act = formatNum(row.actual);
  const bits = [buildSummary(row)];
  if (act == null && (est != null || prev != null)) {
    bits.unshift(
      [est != null ? `Est ${est}` : null, prev != null ? `Prev ${prev}` : null]
        .filter(Boolean)
        .join(" · "),
    );
  }
  return {
    id: `fmp-${sub}-${day}`,
    date: day,
    timeEt,
    title: deskTitle(sub, name),
    subcategory: sub,
    summary: bits.filter(Boolean).join(" — "),
    whyItMatters: WHY[sub],
  };
}

export async function fetchFmpEconomicCalendarJson(options?: {
  apiKey?: string;
  from?: string;
  to?: string;
  now?: Date;
  horizonDays?: number;
  fetchImpl?: typeof fetch;
}): Promise<FmpEconomicEvent[]> {
  const apiKey = options?.apiKey ?? getFmpApiKey();
  if (!apiKey) {
    throw new Error("FMP_API_KEY is not set");
  }
  const now = options?.now ?? new Date();
  const today = now.toISOString().slice(0, 10);
  const from = options?.from ?? today;
  const to =
    options?.to ??
    addUtcDays(today, options?.horizonDays ?? FMP_ECON_HORIZON_DAYS);
  const url = new URL(FMP_ECON_URL);
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);
  url.searchParams.set("apikey", apiKey);

  const fetchImpl = options?.fetchImpl ?? fetch;
  const res = await fetchImpl(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "CatalystIntel/1.0 (macro calendar; contact=ops)",
    },
    cache: "no-store",
  });

  if (res.status === 402) {
    const err = new Error(
      "FMP economic calendar requires a paid plan (HTTP 402).",
    ) as Error & { status: number };
    err.status = 402;
    throw err;
  }
  if (res.status === 401 || res.status === 403) {
    const err = new Error(
      `FMP economic calendar unauthorized (HTTP ${res.status}).`,
    ) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  if (res.status === 429) {
    const err = new Error("FMP rate limited (HTTP 429).") as Error & {
      status: number;
    };
    err.status = 429;
    throw err;
  }
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 200);
    throw new Error(`FMP economic calendar HTTP ${res.status}: ${body}`);
  }

  const data: unknown = await res.json();
  if (!Array.isArray(data)) {
    throw new Error("FMP economic calendar returned a non-array payload");
  }
  return data as FmpEconomicEvent[];
}

/**
 * Fetch + ingest US high-impact (and core medium) FMP economic events.
 */
export async function fetchFmpEconomicCalendar(options?: {
  now?: Date;
  horizonDays?: number;
  fetchImpl?: typeof fetch;
}): Promise<SourceFetchResult> {
  const apiKey = getFmpApiKey();
  if (!apiKey) {
    return skippedSourceResult(
      FMP_ECON_CALENDAR_PROVIDER,
      "FMP_API_KEY is not set — soft-skip. Dedicated ~10m cron when keyed.",
    );
  }

  try {
    const rows = await fetchFmpEconomicCalendarJson({
      apiKey,
      now: options?.now,
      horizonDays: options?.horizonDays,
      fetchImpl: options?.fetchImpl,
    });
    const normalized = rows
      .map(fmpRowToNormalized)
      .filter((n): n is NormalizedCatalyst => n != null);
    const result = await ingestNormalizedCatalysts(normalized, {
      purge: false,
    });
    return toSourceResult(FMP_ECON_CALENDAR_PROVIDER, result);
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error
        ? Number((error as { status: number }).status)
        : undefined;
    const message =
      error instanceof Error ? error.message : "FMP economic calendar failed";

    if (status === 402 || status === 401 || status === 403) {
      return {
        source: FMP_ECON_CALENDAR_PROVIDER,
        configured: true,
        status: "skipped",
        message,
        fetched: 0,
        inserted: 0,
        skipped: 0,
        errors: 0,
        ranAt: new Date().toISOString(),
        purgedCatalysts: 0,
        purgedRawSources: 0,
      };
    }
    if (status === 429) {
      return {
        source: FMP_ECON_CALENDAR_PROVIDER,
        configured: true,
        status: "error",
        message,
        rateLimited: true,
        fetched: 0,
        inserted: 0,
        skipped: 0,
        errors: 1,
        ranAt: new Date().toISOString(),
        purgedCatalysts: 0,
        purgedRawSources: 0,
      };
    }
    return {
      source: FMP_ECON_CALENDAR_PROVIDER,
      configured: true,
      status: "error",
      message,
      fetched: 0,
      inserted: 0,
      skipped: 0,
      errors: 1,
      ranAt: new Date().toISOString(),
      purgedCatalysts: 0,
      purgedRawSources: 0,
    };
  }
}
