/**
 * Structured investor facts from SEC filing plain text (never store/render HTML).
 * Atom metadata alone is AccNo/Size — this layer turns primary-doc text into
 * titles, WIIM-ready summaries, and keyFacts for split view.
 */

import {
  earningsDateForQuarterInference,
  earningsQuarterLabel,
  formatEarningsReportTitle,
  formatSec8kItemTitle,
} from "@/lib/catalysts/catalyst-titles";
import {
  extractItems,
  selectPrimaryItem,
  type ParsedItem,
} from "@/lib/jobs/parse-8k-items";

export type SecExtractCompleteness = "full" | "partial" | "thin";

export interface SecKeyFact {
  label: string;
  value: string;
}

export interface SecFilingExtract {
  eventKind: string;
  completeness: SecExtractCompleteness;
  /** Investor-facing one-liner / short paragraph for summary + split triage. */
  investorSummary: string;
  /** Extra body paragraphs for the details view (plain text only). */
  bodySnippets: string[];
  keyFacts: SecKeyFact[];
  /** Optional tighter tape title when extract finds material numbers/actors. */
  titleOverride?: string | null;
  headlineOverride?: string | null;
  /** 8-K Item codes parsed from primary-doc text (when Atom summary lacked them). */
  parsedItems?: Array<{
    code: string;
    label: string;
    category: string;
  }> | null;
  sourceDoc?: string | null;
}

function cleanMoneyToken(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/** Prefer deal-size dollars; skip per-note $1,000 principal noise. */
export function extractDollarAmount(text: string): string | null {
  const patterns = [
    /(?:aggregate\s+(?:offering\s+)?price|maximum\s+aggregate(?:\s+offering\s+price)?|total\s+offering\s+amount)\s*[:=]?\s*(?:\$|USD\s*)?([\d,]+(?:\.\d+)?)\s*(million|billion|mm|bn|m|b)?/i,
    /(?:price\s+to\s+(?:the\s+)?public|offering\s+price|issue\s+price)\s*[:=]?\s*\$?\s*([\d,]+(?:\.\d+)?)/i,
    /(?:up\s+to|shelf\s+of|offering\s+of)\s*(?:\$|USD\s*)?([\d,]+(?:\.\d+)?)\s*(million|billion|mm|bn|m|b)?/i,
    /\$\s*([\d,]+(?:\.\d+)?)\s*(million|billion|mm|bn)\b/i,
    /\$\s*([\d]{1,3}(?:,\d{3})+(?:\.\d+)?)\b/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const num = m[1];
    const unit = (m[2] ?? "").toLowerCase();
    if (!num) continue;
    const n = Number(num.replace(/,/g, ""));
    // Skip per-security $1,000 principal common on structured notes.
    if (!unit && Number.isFinite(n) && n <= 1000) continue;
    if (unit.startsWith("b")) return cleanMoneyToken(`$${num} billion`);
    if (unit.startsWith("m")) return cleanMoneyToken(`$${num} million`);
    if (num.includes(",") || n >= 1000) {
      return cleanMoneyToken(`$${num}`);
    }
    return cleanMoneyToken(`$${num}`);
  }
  return null;
}

export function extractShareCount(text: string): string | null {
  const patterns = [
    /([\d,]+(?:\.\d+)?)\s*(?:shares\s+of(?:\s+common)?|common\s+shares|american\s+depositary|ads)\b/i,
    /(?:number\s+of\s+shares|shares\s+offered|securities\s+offered)\s*[:=]?\s*([\d,]+(?:\.\d+)?)/i,
    /([\d,]+(?:\.\d+)?)\s*shares\b/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m?.[1]) continue;
    const n = Number(m[1].replace(/,/g, ""));
    if (!Number.isFinite(n) || n < 1) continue;
    return `${m[1]} shares`;
  }
  return null;
}

export function extractOwnershipPercent(text: string): string | null {
  const m = text.match(
    /(?:beneficially\s+owns?|owns?|ownership\s+of|percent\s+of\s+class)[^.%]{0,80}?([\d.]+)\s*%/i,
  );
  if (!m?.[1]) return null;
  return `${m[1]}%`;
}

export function mentionsAtm(text: string): boolean {
  return /\bat[\s-]?the[\s-]?market\b|\bATM\s+(?:offering|program|facility|agreement)\b/i.test(
    text,
  );
}

export function isStructuredNotePricingSupplement(text: string): boolean {
  return (
    /pricing\s+supplement/i.test(text) &&
    /(?:contingent\s+coupon|stated\s+principal\s+amount|worst\s+performing|auto[\s-]?callable|structured\s+note)/i.test(
      text,
    )
  );
}

export function extractContingentCouponRate(text: string): string | null {
  const m = text.match(
    /(?:contingent\s+coupon\s+rate|equivalent\s+to\s+a\s+contingent\s+coupon\s+rate)\s*(?:of\s*)?([\d.]+)\s*%\s*(?:per\s+annum)?/i,
  );
  if (!m?.[1]) return null;
  return `${m[1]}% p.a.`;
}

/** Collapse HTML/XML to plain text for extractors — never for UI dump. */
export function filingTextFromHtml(html: string, maxChars = 80_000): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxChars);
}

/**
 * From an EDGAR index.htm body, pick the best primary document URL
 * (prefer form-type / prospectus / pricing .htm over graphics and exhibits).
 */
export function pickPrimaryDocumentUrl(
  indexHtml: string,
  baseUrl: string,
  formType: string,
): string | null {
  const form = formType.trim().toUpperCase();
  const formStem = form.replace(/\/A$/i, "");
  const candidates: {
    href: string;
    type: string;
    description: string;
    seq: number;
  }[] = [];

  // Prefer full table rows: seq | description | document | type
  // EDGAR uses <td scope="row">…</td> with absolute /Archives/… hrefs.
  const rowRe =
    /<tr[^>]*>\s*<td[^>]*>\s*(\d+)\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>[\s\S]*?href="([^"]+\.(?:htm|html|txt))"[\s\S]*?<\/td>\s*<td[^>]*>\s*([^<]*?)\s*<\/td>/gi;
  let match: RegExpExecArray | null;
  while ((match = rowRe.exec(indexHtml)) !== null) {
    const seq = Number(match[1]);
    const description = match[2]?.replace(/<[^>]+>/g, " ").trim() ?? "";
    const href = match[3]?.trim();
    const type = (match[4] ?? "").trim();
    if (!href || /index\.htm/i.test(href)) continue;
    if (/\.jpg|\.png|\.gif|graphic/i.test(href)) continue;
    candidates.push({
      href,
      type,
      description,
      seq: Number.isFinite(seq) ? seq : 99,
    });
  }

  // Fallback: any document link
  if (candidates.length === 0) {
    const hrefRe = /href="([^"]+\.(?:htm|html|txt))"/gi;
    while ((match = hrefRe.exec(indexHtml)) !== null) {
      const href = match[1]?.trim();
      if (!href || /index\.htm/i.test(href)) continue;
      if (/\.jpg|\.png|\.gif/i.test(href)) continue;
      candidates.push({
        href,
        type: "",
        description: "",
        seq: candidates.length + 1,
      });
    }
  }

  if (candidates.length === 0) return null;

  function score(c: (typeof candidates)[number]): number {
    const type = c.type.toUpperCase().replace(/\s+/g, "");
    const blob = `${c.type} ${c.description} ${c.href}`.toLowerCase();
    let s = 0;
    if (type === form.replace(/\s+/g, "") || type.includes(formStem)) s += 100;
    if (/^424B/i.test(form) && /424B/i.test(type)) s += 90;
    if (/^S-3/i.test(form) && /S-3/i.test(type)) s += 90;
    if (/prospectus|pricing|supplement|registration/i.test(blob)) s += 50;
    if (/ex-\d|exhibit|graphic|cover\.htm/i.test(blob)) s -= 60;
    if (/\.txt$/i.test(c.href) && candidates.length > 1) s -= 20;
    s -= c.seq;
    return s;
  }

  const scored = [...candidates].sort((a, b) => score(b) - score(a));
  const best = scored[0];
  if (!best) return null;
  return resolveEdgarDocumentHref(best.href, baseUrl);
}

/** Resolve index document hrefs (absolute /Archives paths or relative names). */
export function resolveEdgarDocumentHref(
  href: string,
  baseUrl: string,
): string {
  const h = href.trim();
  if (h.startsWith("http://") || h.startsWith("https://")) return h;
  if (h.startsWith("/")) return `https://www.sec.gov${h}`;
  const base = baseUrl.replace(/\/[^/]*$/, "/");
  return `${base}${h.replace(/^\.\//, "")}`;
}

/** Recover Item codes from enrich labels like "5.02 Officer / Director Change". */
function itemsFromItemLabels(
  labels: string[] | null | undefined,
): ParsedItem[] {
  if (!labels?.length) return [];
  const codes: string[] = [];
  for (const label of labels) {
    const trimmed = label.trim();
    const match = trimmed.match(/^(\d+\.\d+)\b/);
    if (match) codes.push(`Item ${match[1]}`);
  }
  if (codes.length === 0) return extractItems(labels.join(" "));
  return extractItems(codes.join(" "));
}

function mergeParsedItems(
  primary: ParsedItem[],
  secondary: ParsedItem[],
): ParsedItem[] {
  if (primary.length === 0) return secondary;
  if (secondary.length === 0) return primary;
  const seen = new Set(primary.map((i) => i.code));
  const out = [...primary];
  for (const item of secondary) {
    if (seen.has(item.code)) continue;
    seen.add(item.code);
    out.push(item);
  }
  return out;
}

function subjectLabel(input: {
  ticker?: string | null;
  companyName?: string | null;
}): string {
  const ticker = input.ticker?.trim().toUpperCase() || null;
  const company = input.companyName?.trim() || null;
  if (ticker && company && company.toUpperCase() !== ticker) {
    return `${company} (${ticker})`;
  }
  return ticker || company || "Issuer";
}

const NOISE_SNIPPET =
  /^(united states|securities and exchange|table of contents|check the appropriate|commission file|form\s+\d|as filed with)/i;

/** Prefer real sentences; fall back to long non-meta chunks (SEC text often lacks periods). */
export function firstSentences(
  text: string,
  max = 3,
  maxChars = 480,
): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const out: string[] = [];

  const parts = cleaned.split(/(?<=[.!?])\s+/).filter((s) => s.length > 50);
  for (const p of parts) {
    if (out.length >= max) break;
    if (/^Filed:\s*\d{4}/i.test(p) || /\bAccNo:\s*\d/i.test(p)) continue;
    if (NOISE_SNIPPET.test(p)) continue;
    if (/^Item\s+\d+\.\d+/i.test(p) && p.length < 80) continue;
    out.push(p.length > maxChars ? `${p.slice(0, maxChars - 1)}…` : p);
  }

  if (out.length > 0) return out;

  // Chunk fallback for prospectus text without clean sentence breaks.
  const window = 280;
  for (let i = 0; i < cleaned.length && out.length < max; i += window) {
    const chunk = cleaned.slice(i, i + window).trim();
    if (chunk.length < 80) continue;
    if (NOISE_SNIPPET.test(chunk)) continue;
    if (/\bAccNo:\s*\d/i.test(chunk)) continue;
    out.push(chunk.length >= window ? `${chunk}…` : chunk);
  }
  return out;
}

export function extractFromFilingText(input: {
  formType: string;
  text: string;
  ticker?: string | null;
  companyName?: string | null;
  itemLabels?: string[] | null;
  sourceDoc?: string | null;
}): SecFilingExtract {
  const form = input.formType.trim().toUpperCase();
  const text = input.text;
  const subject = subjectLabel(input);
  const keyFacts: SecKeyFact[] = [];
  const bodySnippets = firstSentences(text, 3, 480);
  const structured = isStructuredNotePricingSupplement(text);
  const dollar = structured ? null : extractDollarAmount(text);
  const shares = structured ? null : extractShareCount(text);
  const coupon = structured ? extractContingentCouponRate(text) : null;
  const pct = extractOwnershipPercent(text);
  const atm = mentionsAtm(text);

  if (dollar) keyFacts.push({ label: "Amount", value: dollar });
  if (shares) keyFacts.push({ label: "Shares", value: shares });
  if (coupon) keyFacts.push({ label: "Coupon", value: coupon });
  if (pct) keyFacts.push({ label: "Ownership", value: pct });
  if (atm) keyFacts.push({ label: "Facility", value: "At-the-market (ATM)" });

  // --- Capital: S-3 / 424B ---
  if (/^S-3/i.test(form)) {
    const amended = /\/A$/i.test(form);
    const kind = atm ? "atm_shelf" : "shelf";
    const amountBit = dollar ? ` covering up to ${dollar}` : "";
    const atmBit = atm ? " including an at-the-market (ATM) facility" : "";
    const investorSummary = amended
      ? `${subject} filed an amended shelf registration (S-3/A)${amountBit}${atmBit}. Shelf registrations let issuers sell securities over time — watch for dilution capacity.`
      : `${subject} filed a shelf registration (S-3)${amountBit}${atmBit}. This sets up potential future share sales rather than an immediately priced deal.`;
    const completeness: SecExtractCompleteness =
      dollar || atm || bodySnippets.length > 0 ? "partial" : "thin";
    return {
      eventKind: kind,
      completeness: dollar ? "full" : completeness,
      investorSummary,
      bodySnippets,
      keyFacts: [
        { label: "Form", value: form },
        { label: "Type", value: atm ? "Shelf + ATM" : "Shelf registration" },
        ...keyFacts,
      ],
      titleOverride: dollar
        ? `${input.ticker?.toUpperCase() || subject} — ${amended ? "Amends shelf" : "Shelf"} ${dollar}${atm ? " (ATM)" : ""}`
        : `${input.ticker?.toUpperCase() || subject} — ${amended ? "Amends shelf registration" : "Shelf registration"} (${form})`,
      headlineOverride: atm ? "Shelf / ATM registration" : "Shelf registration",
      sourceDoc: input.sourceDoc ?? null,
    };
  }

  if (/^424B/i.test(form)) {
    if (structured) {
      const couponBit = coupon ? ` Contingent coupon ~${coupon}.` : "";
      const detailBit = coupon
        ? " These are issuer debt-linked products (not a classic company share sale)."
        : " These are issuer debt-linked products (not a classic company share sale). Coupon or barrier figures were not clearly listed in the extract we have.";
      const investorSummary = `${subject} filed a ${form} pricing supplement for structured notes.${couponBit}${detailBit}`;
      const completeness: SecExtractCompleteness =
        coupon || bodySnippets.length > 0 ? "partial" : "thin";
      return {
        eventKind: "structured_note",
        completeness: coupon ? "full" : completeness,
        investorSummary,
        bodySnippets,
        keyFacts: [
          { label: "Form", value: form },
          { label: "Type", value: "Pricing supplement (structured note)" },
          ...keyFacts,
        ],
        titleOverride: coupon
          ? `${input.ticker?.toUpperCase() || subject} — Structured note · ${coupon}`
          : `${input.ticker?.toUpperCase() || subject} — Structured note pricing supplement`,
        headlineOverride: "Structured note / pricing supplement",
        sourceDoc: input.sourceDoc ?? null,
      };
    }

    const investorSummary = dollar
      ? `${subject} filed a prospectus supplement (${form}) — priced/registered offering around ${dollar}${shares ? ` (${shares})` : ""}. Secondary/follow-on supply can pressure the stock near print.`
      : `${subject} filed a ${form} prospectus supplement (capital markets). Check size and price when listed — dilution risk around priced deals.`;
    const completeness: SecExtractCompleteness =
      dollar || shares ? "full" : bodySnippets.length > 0 ? "partial" : "thin";
    return {
      eventKind: "priced_offering",
      completeness,
      investorSummary,
      bodySnippets,
      keyFacts: [
        { label: "Form", value: form },
        { label: "Type", value: "Prospectus supplement" },
        ...keyFacts,
      ],
      titleOverride: dollar
        ? `${input.ticker?.toUpperCase() || subject} — Offering ${dollar}${shares ? ` · ${shares}` : ""}`
        : `${input.ticker?.toUpperCase() || subject} — Prospectus supplement (${form})`,
      headlineOverride: "Priced / registered offering",
      sourceDoc: input.sourceDoc ?? null,
    };
  }

  // --- Ownership 13D/G ---
  if (/13D/i.test(form)) {
    const investorSummary = pct
      ? `${subject} has a Schedule 13D ownership filing — reported stake around ${pct}. 13D often signals activist or control intent versus passive 13G.`
      : `${subject} has a Schedule 13D ownership filing (active/control-oriented stake disclosure).`;
    return {
      eventKind: "13d",
      completeness: pct ? "full" : "partial",
      investorSummary,
      bodySnippets,
      keyFacts: [
        { label: "Form", value: form },
        { label: "Type", value: "Active ownership (13D)" },
        ...keyFacts,
      ],
      titleOverride: pct
        ? `${input.ticker?.toUpperCase() || subject} — 13D stake ~${pct}`
        : `${input.ticker?.toUpperCase() || subject} — Schedule 13D`,
      headlineOverride: "Schedule 13D (active stake)",
      sourceDoc: input.sourceDoc ?? null,
    };
  }

  if (/13G/i.test(form)) {
    const investorSummary = pct
      ? `${subject} has a Schedule 13G ownership filing — reported stake around ${pct}. 13G is typically passive institutional ownership.`
      : `${subject} has a Schedule 13G ownership filing (usually passive institutional).`;
    return {
      eventKind: "13g",
      completeness: pct ? "full" : "partial",
      investorSummary,
      bodySnippets,
      keyFacts: [
        { label: "Form", value: form },
        { label: "Type", value: "Passive ownership (13G)" },
        ...keyFacts,
      ],
      titleOverride: pct
        ? `${input.ticker?.toUpperCase() || subject} — 13G stake ~${pct}`
        : `${input.ticker?.toUpperCase() || subject} — Schedule 13G`,
      headlineOverride: "Schedule 13G (passive stake)",
      sourceDoc: input.sourceDoc ?? null,
    };
  }

  // --- 8-K ---
  if (/^8-?K/i.test(form)) {
    const fromText = extractItems(text);
    const fromLabels = itemsFromItemLabels(input.itemLabels);
    const items = mergeParsedItems(fromText, fromLabels);
    const primary = selectPrimaryItem(items);
    const itemBit =
      items.length > 0
        ? ` Highlights: ${items
            .slice(0, 3)
            .map((i) => i.label)
            .join("; ")}.`
        : "";
    const peek = bodySnippets[0];
    const reason = primary?.label ?? "a material event";
    const investorSummary = peek
      ? `${subject} disclosed ${reason} in a current report.${itemBit} ${peek}`
      : `${subject} disclosed ${reason} in a current SEC report.${itemBit} Open Details for exhibit text — this is a material disclosure traders screen in real time.`;

    let titleOverride: string | null = null;
    let headlineOverride: string | null = null;
    if (primary) {
      if (primary.code === "2.02") {
        const quarter = earningsQuarterLabel(
          null,
          earningsDateForQuarterInference({
            summary: text.slice(0, 2000),
            timestamp: null,
          }),
        );
        titleOverride = formatEarningsReportTitle(
          quarter,
          input.companyName || input.ticker,
        );
        headlineOverride = titleOverride;
      } else {
        titleOverride = formatSec8kItemTitle(
          primary.label,
          input.companyName || input.ticker,
          { content: text },
        );
        headlineOverride = primary.label;
      }
    } else {
      titleOverride = formatSec8kItemTitle(
        "Current report",
        input.companyName || input.ticker,
      );
      headlineOverride = "Current report";
    }

    return {
      eventKind: "8k",
      completeness: peek || items.length > 0 ? "partial" : "thin",
      investorSummary: investorSummary.slice(0, 900),
      bodySnippets,
      keyFacts: [
        { label: "Form", value: form },
        ...(items.length
          ? [
              {
                label: "Items",
                value: items
                  .slice(0, 4)
                  .map((i) => `${i.code} ${i.label}`)
                  .join(" · "),
              },
            ]
          : []),
        ...keyFacts,
      ],
      titleOverride,
      headlineOverride,
      parsedItems: items.length
        ? items.map((i) => ({
            code: i.code,
            label: i.label,
            category: i.category,
          }))
        : null,
      sourceDoc: input.sourceDoc ?? null,
    };
  }

  // Generic filing
  return {
    eventKind: "sec_filing",
    completeness: bodySnippets.length > 0 ? "partial" : "thin",
    investorSummary: `${subject} filed a ${form} with the SEC.${dollar ? ` Amount mentioned: ${dollar}.` : ""} Current disclosure for capital-markets and ownership screens.`,
    bodySnippets,
    keyFacts: [{ label: "Form", value: form }, ...keyFacts],
    sourceDoc: input.sourceDoc ?? null,
  };
}

/** Atom AccNo/Size-only blurbs are not investor content. */
export function isAtomMetadataOnly(
  summary: string | null | undefined,
): boolean {
  const t = summary?.replace(/\s+/g, " ").trim() ?? "";
  if (!t) return true;
  if (/^Filed:\s*\d{4}-\d{2}-\d{2}\s+AccNo:/i.test(t) && t.length < 120) {
    // Short AccNo-led line with no Item / narrative payload.
    if (!/\bItem\s+\d+\.\d+/i.test(t) && t.length < 160) return true;
  }
  if (/\bAccNo:\s*[\d-]+/i.test(t) && /\bSize:\s*\d+/i.test(t)) {
    const withoutMeta = t
      .replace(/Filed:\s*[\d-]+/gi, "")
      .replace(/AccNo:\s*[\d-]+/gi, "")
      .replace(/Size:\s*[\d.]+\s*KB/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    // Item codes or any real sentence after meta → keep.
    if (withoutMeta.length < 40 && !/\bItem\s+\d+\.\d+/i.test(t)) return true;
    if (withoutMeta.length < 24) return true;
  }
  return false;
}
