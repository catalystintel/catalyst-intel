import { XMLParser } from "fast-xml-parser";

import type { NormalizedCatalyst } from "@/lib/jobs/ingest-pipeline";

/** SEC transaction codes treated as purchase / acquisition. */
const BUY_CODES = new Set(["P", "A", "M", "I", "L", "W", "Z"]);

/** SEC transaction codes treated as sale / disposition. */
const SELL_CODES = new Set(["S", "D", "F", "G", "H", "C", "U"]);

export type Form4Subcategory =
  "insider_buy" | "insider_sell" | "form4_mixed" | "form4";

export interface Form4Direction {
  subcategory: Form4Subcategory;
  headline: string;
  buyCount: number;
  sellCount: number;
  codes: string[];
}

/** Accession folder segment (dashes stripped) for EDGAR archive paths. */
export function accessionToFolder(accessionNumber: string): string {
  return accessionNumber.replace(/-/g, "");
}

/** Pull accession from `sec-edgar:{accession}` external ids. */
export function accessionFromSecExternalId(externalId: string): string | null {
  const match = externalId.match(/^sec-edgar:(.+)$/);
  return match?.[1]?.trim() || null;
}

/** True when a normalized row is an EDGAR Form 4 Atom entry. */
export function isForm4Normalized(item: NormalizedCatalyst): boolean {
  const raw = item.rawContent as Record<string, unknown> | null;
  const formType = String(raw?.formType ?? item.type ?? "").trim();
  return formType === "4" || /^4(\/|$)/i.test(formType);
}

/** Common ownership XML URL guesses before index discovery. */
export function candidateForm4XmlUrls(
  cik: number,
  accessionNumber: string,
): string[] {
  const folder = accessionToFolder(accessionNumber);
  const base = `https://www.sec.gov/Archives/edgar/data/${cik}/${folder}`;
  return [
    `${base}/${accessionNumber}.xml`,
    `${base}/ownership.xml`,
    `${base}/form4.xml`,
    `${base}/primary_doc.xml`,
    `${base}/xslF345X03/wf-form4_1.xml`,
  ];
}

/** Parse filing index HTML for ownership / Form 4 XML hrefs. */
export function extractForm4XmlHrefsFromIndex(
  indexHtml: string,
  cik: number,
  accessionNumber: string,
): string[] {
  const folder = accessionToFolder(accessionNumber);
  const base = `https://www.sec.gov/Archives/edgar/data/${cik}/${folder}`;
  const hrefs = new Set<string>();
  const re = /href="([^"]+\.xml)"/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(indexHtml)) !== null) {
    const href = match[1]?.trim();
    if (!href) continue;
    if (!/form4|ownership|doc4|345/i.test(href)) continue;
    if (href.startsWith("http")) {
      hrefs.add(href);
    } else {
      hrefs.add(`${base}/${href.replace(/^\//, "")}`);
    }
  }
  return [...hrefs];
}

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function transactionCodeFromNode(node: unknown): string | null {
  if (!node || typeof node !== "object") return null;
  const record = node as Record<string, unknown>;
  const coding = record.transactionCoding;
  const codingRecord = Array.isArray(coding)
    ? (coding[0] as Record<string, unknown> | undefined)
    : (coding as Record<string, unknown> | undefined);
  const raw = codingRecord?.transactionCode;
  const text =
    typeof raw === "string"
      ? raw
      : raw && typeof raw === "object"
        ? String((raw as Record<string, unknown>)["#text"] ?? "")
        : "";
  const code = text.trim().toUpperCase();
  return code ? code.charAt(0) : null;
}

function collectTransactionCodes(doc: Record<string, unknown>): string[] {
  const codes: string[] = [];
  const tables = [
    doc.nonDerivativeTable as Record<string, unknown> | undefined,
    doc.derivativeTable as Record<string, unknown> | undefined,
  ];

  for (const table of tables) {
    if (!table) continue;
    const transactions = [
      ...toArray(
        table.nonDerivativeTransaction as
          Record<string, unknown> | Record<string, unknown>[] | undefined,
      ),
      ...toArray(
        table.derivativeTransaction as
          Record<string, unknown> | Record<string, unknown>[] | undefined,
      ),
    ];
    for (const tx of transactions) {
      const code = transactionCodeFromNode(tx);
      if (code) codes.push(code);
    }
  }

  return codes;
}

/**
 * Parse Form 4 ownership XML into buy/sell/mixed subcategories.
 * Returns null when no transaction codes are found.
 */
export function parseForm4OwnershipXml(xml: string): Form4Direction | null {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(xml) as Record<string, unknown>;
  } catch {
    return null;
  }

  const doc = parsed.ownershipDocument as Record<string, unknown> | undefined;
  if (!doc) return null;

  const codes = collectTransactionCodes(doc);
  if (codes.length === 0) return null;

  let buyCount = 0;
  let sellCount = 0;
  for (const code of codes) {
    if (BUY_CODES.has(code)) buyCount++;
    else if (SELL_CODES.has(code)) sellCount++;
  }

  if (buyCount > 0 && sellCount === 0) {
    return {
      subcategory: "insider_buy",
      headline: "Insider buy (Form 4)",
      buyCount,
      sellCount,
      codes,
    };
  }
  if (sellCount > 0 && buyCount === 0) {
    return {
      subcategory: "insider_sell",
      headline: "Insider sell (Form 4)",
      buyCount,
      sellCount,
      codes,
    };
  }
  if (buyCount > 0 && sellCount > 0) {
    return {
      subcategory: "form4_mixed",
      headline: "Mixed insider transactions (Form 4)",
      buyCount,
      sellCount,
      codes,
    };
  }

  return {
    subcategory: "form4",
    headline: "Form 4 insider transaction",
    buyCount,
    sellCount,
    codes,
  };
}
