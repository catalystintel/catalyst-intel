/**
 * Desk Economic Calendar data: prefer FMP-ingested core prints when present,
 * else the keyless embedded BLS/Fed schedule.
 */

import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";

import { db } from "@/db/client";
import { catalysts, rawSources } from "@/db/schema";
import {
  buildUpcomingMacroEvents,
  type MacroEventDef,
} from "@/lib/jobs/fetch-macro-calendar";
import {
  FMP_ECON_CALENDAR_PROVIDER,
  fmpRowToMacroEventDef,
  type FmpEconomicEvent,
} from "@/lib/jobs/fetch-fmp-economic-calendar";

const DESK_SUBS = ["cpi", "nfp", "ppi", "fomc"] as const;

function timeEtFromIso(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "08:30";
  const etMs = ms - 4 * 60 * 60 * 1000;
  const et = new Date(etMs);
  return `${String(et.getUTCHours()).padStart(2, "0")}:${String(et.getUTCMinutes()).padStart(2, "0")}`;
}

function rowToMacroEvent(row: {
  id: number;
  title: string;
  subcategory: string | null;
  timestamp: string;
  summary: string | null;
  rawContent: unknown;
}): MacroEventDef | null {
  const sub = (row.subcategory ?? "").toLowerCase();
  if (!DESK_SUBS.includes(sub as (typeof DESK_SUBS)[number])) return null;

  const raw = row.rawContent as FmpEconomicEvent | null;
  if (raw && typeof raw === "object" && typeof raw.date === "string") {
    const fromRaw = fmpRowToMacroEventDef(raw);
    if (fromRaw) return fromRaw;
  }

  const day = row.timestamp.slice(0, 10);
  const why: Record<(typeof DESK_SUBS)[number], string> = {
    cpi: "Primary inflation print — moves rate odds, USD, and equity risk appetite.",
    nfp: "Jobs + unemployment — Fed reaction function and growth narrative.",
    fomc: "Policy decision + statement — highest-impact scheduled US macro event.",
    ppi: "Pipeline inflation — often foreshadows CPI and sector leadership.",
  };

  return {
    id: `fmp-db-${sub}-${day}-${row.id}`,
    date: day,
    timeEt: timeEtFromIso(row.timestamp),
    title: row.title,
    subcategory: sub as MacroEventDef["subcategory"],
    summary: row.summary ?? row.title,
    whyItMatters: why[sub as (typeof DESK_SUBS)[number]],
  };
}

/**
 * Upcoming CPI / NFP / PPI / FOMC for the dashboard rail.
 * Uses FMP rows when the dedicated cron has populated them; otherwise
 * embedded keyless schedule.
 */
export async function loadDeskMacroEvents(
  now = new Date(),
  horizonDays = 120,
): Promise<MacroEventDef[]> {
  const today = now.toISOString().slice(0, 10);
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + horizonDays);
  const endIso = end.toISOString();

  try {
    const rows = await db
      .select({
        id: catalysts.id,
        title: catalysts.title,
        subcategory: catalysts.subcategory,
        timestamp: catalysts.timestamp,
        summary: catalysts.summary,
        rawContent: rawSources.rawContent,
      })
      .from(catalysts)
      .innerJoin(rawSources, eq(catalysts.rawSourceId, rawSources.id))
      .where(
        and(
          eq(rawSources.provider, FMP_ECON_CALENDAR_PROVIDER),
          gte(catalysts.timestamp, `${today}T00:00:00.000Z`),
          lte(catalysts.timestamp, endIso),
          inArray(catalysts.subcategory, [...DESK_SUBS]),
        ),
      )
      .orderBy(asc(catalysts.timestamp))
      .limit(40);

    const mapped = rows
      .map(rowToMacroEvent)
      .filter((e): e is MacroEventDef => e != null);

    const seen = new Set<string>();
    const deduped: MacroEventDef[] = [];
    for (const e of mapped) {
      const key = `${e.subcategory}:${e.date}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(e);
    }

    if (deduped.length > 0) return deduped;
  } catch (error) {
    console.error("loadDeskMacroEvents FMP query failed:", error);
  }

  return buildUpcomingMacroEvents(now, horizonDays);
}
