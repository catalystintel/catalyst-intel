/**
 * Async-ish SEC primary-document enrichment during Atom ingest.
 * Fetches index + primary .htm, extracts plain-text facts, updates the
 * NormalizedCatalyst in place. Never passes HTML to the UI layer.
 */

import type { NormalizedCatalyst } from "@/lib/jobs/ingest-pipeline";
import { accessionToFolder, isForm4Normalized } from "@/lib/jobs/parse-form4";
import {
  extractFromFilingText,
  filingTextFromHtml,
  isAtomMetadataOnly,
  pickPrimaryDocumentUrl,
  type SecFilingExtract,
} from "@/lib/jobs/sec-filing-extract";
import { selectPrimaryItem, type ParsedItem } from "@/lib/jobs/parse-8k-items";
import { type SecFetchMode, fetchSecUrl } from "@/lib/jobs/sec-edgar-http";
import {
  isEventCategoryKey,
  type EventCategoryKey,
} from "@/lib/catalysts/taxonomy";

function formNeedsDocEnrich(formType: string): boolean {
  const f = formType.trim().toUpperCase();
  return (
    /^8-?K/i.test(f) ||
    /^S-3/i.test(f) ||
    /^424B/i.test(f) ||
    /13D/i.test(f) ||
    /13G/i.test(f)
  );
}

function applyExtract(
  item: NormalizedCatalyst,
  extract: SecFilingExtract,
): void {
  const raw = item.rawContent as Record<string, unknown>;
  raw.extracted = extract;

  if (extract.investorSummary) {
    item.summary = extract.investorSummary;
  }
  if (extract.titleOverride?.trim()) {
    item.title = extract.titleOverride.trim();
  }
  if (extract.headlineOverride?.trim()) {
    item.headline = extract.headlineOverride.trim();
  }

  const parsed = (extract.parsedItems ?? [])
    .map((entry): ParsedItem | null => {
      if (
        typeof entry?.code === "string" &&
        typeof entry?.label === "string" &&
        typeof entry?.category === "string" &&
        isEventCategoryKey(entry.category)
      ) {
        return {
          code: entry.code,
          label: entry.label,
          category: entry.category as EventCategoryKey,
        };
      }
      return null;
    })
    .filter((x): x is ParsedItem => x !== null);

  if (parsed.length > 0) {
    item.itemCodes = parsed;
    const primary = selectPrimaryItem(parsed);
    if (primary) {
      item.eventCategory = primary.category;
      if (/^8-?K/i.test(item.type)) {
        item.subcategory = "8k";
      }
    }
  }

  if (extract.completeness === "full") {
    item.confidence = Math.max(item.confidence ?? 0, 88);
  } else if (extract.completeness === "partial") {
    item.confidence = Math.max(item.confidence ?? 0, 80);
  }
}

/**
 * Cap-fetch primary filing HTML → plain-text extract for non–Form-4 SEC rows.
 * Soft-fails per row; Atom entries still ingest with sanitized summaries.
 * Capital forms (424B / S-3) are enriched first so offering rows clear the content bar.
 */
export async function enrichSecFilingDocuments(
  items: NormalizedCatalyst[],
  options: {
    userAgent: string;
    mode?: SecFetchMode;
    /** Override per-tick fetch budget (default 100 primary / 16 background). */
    limit?: number;
  },
): Promise<{ attempted: number; enriched: number }> {
  const mode = options.mode ?? "primary";
  const cap =
    typeof options.limit === "number" && options.limit > 0
      ? options.limit
      : mode === "background"
        ? 16
        : 100;
  let attempted = 0;
  let enriched = 0;

  function capitalPriority(formType: string): number {
    const f = formType.trim().toUpperCase();
    if (/^424B/i.test(f)) return 0;
    if (/^S-3/i.test(f)) return 1;
    if (/^8-?K/i.test(f)) return 2;
    return 3;
  }

  const queue = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      if (item.provider !== "sec-edgar") return false;
      if (isForm4Normalized(item)) return false;
      const raw = item.rawContent as Record<string, unknown>;
      const extracted = raw.extracted as { sourceDoc?: string } | undefined;
      // Already has primary-doc extract — leave it.
      if (extracted?.sourceDoc) return false;
      const formType = String(raw.formType ?? item.type ?? "").trim();
      return formNeedsDocEnrich(formType);
    })
    .sort((a, b) => {
      const aForm = String(
        (a.item.rawContent as Record<string, unknown>).formType ??
          a.item.type ??
          "",
      );
      const bForm = String(
        (b.item.rawContent as Record<string, unknown>).formType ??
          b.item.type ??
          "",
      );
      const byForm = capitalPriority(aForm) - capitalPriority(bForm);
      return byForm !== 0 ? byForm : a.index - b.index;
    });

  for (const { item } of queue) {
    const raw = item.rawContent as Record<string, unknown>;
    const formType = String(raw.formType ?? item.type ?? "").trim();

    const cik = raw.cik as number | undefined;
    const accessionNumber = raw.accessionNumber as string | undefined;
    if (!cik || !accessionNumber) continue;
    if (attempted >= cap) break;

    attempted++;

    try {
      const folder = accessionToFolder(accessionNumber);
      const base = `https://www.sec.gov/Archives/edgar/data/${cik}/${folder}`;
      const indexUrl =
        (typeof raw.link === "string" && raw.link.includes("index.htm")
          ? raw.link
          : null) || `${base}/${accessionNumber}-index.htm`;

      const indexRes = await fetchSecUrl(indexUrl, {
        userAgent: options.userAgent,
        mode,
      });
      if (!indexRes.ok) continue;
      const indexHtml = await indexRes.text();
      const docUrl = pickPrimaryDocumentUrl(indexHtml, indexUrl, formType);
      if (!docUrl) continue;

      const docRes = await fetchSecUrl(docUrl, {
        userAgent: options.userAgent,
        mode,
      });
      if (!docRes.ok) continue;
      const html = await docRes.text();
      const text = filingTextFromHtml(html);
      if (text.length < 80) continue;

      const itemLabels =
        item.itemCodes?.map((i) =>
          i.code && i.label ? `${i.code} ${i.label}` : i.label || i.code || "",
        ) ?? null;

      const extract = extractFromFilingText({
        formType,
        text,
        ticker: item.symbol,
        companyName: item.companyName,
        itemLabels,
        sourceDoc: docUrl,
      });

      applyExtract(item, extract);
      enriched++;
      // Brief pause so EDGAR doesn't soft-block burst primary-doc fetches.
      await new Promise((r) => setTimeout(r, 120));
    } catch {
      // Soft-fail — keep Atom row.
    }
  }

  return { attempted, enriched };
}

/**
 * When document enrich did not run (or failed), still replace AccNo-only
 * Atom blurbs with investor-facing synthesized copy from form class.
 */
export function sanitizeSecAtomSummaries(items: NormalizedCatalyst[]): void {
  for (const item of items) {
    if (item.provider !== "sec-edgar") continue;
    if (isForm4Normalized(item)) continue;

    const raw = item.rawContent as Record<string, unknown>;
    if (raw.extracted) continue;

    const atomSummary =
      typeof raw.summary === "string" ? raw.summary : item.summary;
    if (!isAtomMetadataOnly(atomSummary) && !isAtomMetadataOnly(item.summary)) {
      // Keep 8-K item legalese for parsers but prefer a readable wrapper.
      if (
        /^8-?K/i.test(String(raw.formType ?? item.type)) &&
        item.itemCodes?.length
      ) {
        const subject =
          item.symbol && item.companyName
            ? `${item.companyName} (${item.symbol})`
            : item.symbol || item.companyName || "Issuer";
        const itemsLabel = item.itemCodes
          .slice(0, 3)
          .map((i) =>
            i.code && i.label
              ? `Item ${i.code} (${i.label})`
              : i.label || `Item ${i.code}`,
          )
          .join(", ");
        item.summary = `${subject} disclosed ${item.headline || "a material event"} in a current report. The filing highlights ${itemsLabel}. This is a current SEC disclosure traders watch for material company news.`;
      }
      continue;
    }

    const formType = String(raw.formType ?? item.type ?? "SEC filing");
    const extract = extractFromFilingText({
      formType,
      text: typeof atomSummary === "string" ? atomSummary : "",
      ticker: item.symbol,
      companyName: item.companyName,
      itemLabels: item.itemCodes?.map((i) => i.label || i.code || "") ?? null,
    });
    // Mark thin extract so UI knows Atom-only path.
    extract.completeness = "thin";
    applyExtract(item, extract);
  }
}

/**
 * Re-enrich persisted SEC rows that still lack a primary-doc extract.
 * Used by local refresh / catch-up so AI triage sees real filing text.
 */
export async function backfillSecFilingExtractsFromDb(options: {
  userAgent: string;
  limit?: number;
  mode?: SecFetchMode;
}): Promise<{ scanned: number; enriched: number }> {
  const { db } = await import("@/db/client");
  const { catalysts, rawSources } = await import("@/db/schema");
  const { and, eq, sql } = await import("drizzle-orm");
  const limit = Math.max(1, options.limit ?? 200);

  const rows = await db
    .select({
      catalystId: catalysts.id,
      rawSourceId: rawSources.id,
      type: catalysts.type,
      title: catalysts.title,
      headline: catalysts.headline,
      summary: catalysts.summary,
      symbol: catalysts.symbol,
      companyName: catalysts.companyName,
      itemCodes: catalysts.itemCodes,
      confidence: catalysts.confidence,
      eventCategory: catalysts.eventCategory,
      subcategory: catalysts.subcategory,
      url: rawSources.url,
      rawContent: rawSources.rawContent,
    })
    .from(catalysts)
    .innerJoin(rawSources, eq(catalysts.rawSourceId, rawSources.id))
    .where(
      and(
        eq(rawSources.provider, "sec-edgar"),
        sql`json_extract(${rawSources.rawContent}, '$.extracted.sourceDoc') IS NULL`,
      ),
    )
    .orderBy(
      sql`CASE
        WHEN ${catalysts.type} LIKE '424B%' THEN 0
        WHEN ${catalysts.type} LIKE 'S-3%' THEN 1
        WHEN ${catalysts.type} LIKE '8-K%' THEN 2
        ELSE 3 END`,
      sql`${catalysts.timestamp} DESC`,
    )
    .limit(Math.min(limit * 2, 500))
    .all();

  const items: NormalizedCatalyst[] = [];
  const rowIndex: typeof rows = [];
  for (const row of rows) {
    if (items.length >= limit) break;
    const raw =
      row.rawContent && typeof row.rawContent === "object"
        ? ({ ...(row.rawContent as Record<string, unknown>) } as Record<
            string,
            unknown
          >)
        : {};
    const draft: NormalizedCatalyst = {
      provider: "sec-edgar",
      externalId: `backfill:${row.rawSourceId}`,
      url: row.url,
      rawContent: raw,
      symbol: row.symbol,
      companyName: row.companyName,
      type: row.type,
      title: row.title,
      headline: row.headline,
      summary: row.summary,
      itemCodes: Array.isArray(row.itemCodes)
        ? (row.itemCodes as NormalizedCatalyst["itemCodes"])
        : null,
      timestamp: new Date().toISOString(),
      confidence: row.confidence ?? 70,
      tags: [],
      eventCategory:
        (row.eventCategory as NormalizedCatalyst["eventCategory"]) || "other",
      subcategory: row.subcategory,
    };
    if (isForm4Normalized(draft)) continue;
    if (!formNeedsDocEnrich(row.type)) continue;
    items.push(draft);
    rowIndex.push(row);
  }

  await enrichSecFilingDocuments(items, {
    userAgent: options.userAgent,
    mode: options.mode ?? "primary",
    limit,
  });

  let written = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const row = rowIndex[i];
    const raw = item.rawContent as Record<string, unknown>;
    const extracted = raw.extracted as { sourceDoc?: string } | undefined;
    if (!extracted?.sourceDoc) continue;

    await db
      .update(rawSources)
      .set({ rawContent: raw })
      .where(eq(rawSources.id, row.rawSourceId))
      .run();
    await db
      .update(catalysts)
      .set({
        title: item.title,
        headline: item.headline,
        summary: item.summary,
        confidence: item.confidence,
        itemCodes: item.itemCodes ?? null,
        eventCategory: item.eventCategory,
        subcategory: item.subcategory,
      })
      .where(eq(catalysts.id, row.catalystId))
      .run();
    written++;
  }

  return { scanned: rowIndex.length, enriched: written };
}
