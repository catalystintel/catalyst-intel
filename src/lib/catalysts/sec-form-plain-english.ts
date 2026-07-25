/**
 * Plain-English glosses for common SEC form types — entry-level investor friendly.
 * Used in summaries, takeaways, and AI context. Not investment advice.
 */

export function plainEnglishForSecForm(
  formType: string | null | undefined,
): string | null {
  const f = (formType ?? "").trim().toUpperCase();
  if (!f) return null;

  if (/^424B/i.test(f)) {
    return "This is a prospectus supplement (often a structured note or other offering terms from a bank or issuer). It is usually not a simple “company sells new shares” story — read coupon, size, and whether principal can be at risk.";
  }
  if (/^S-3/i.test(f)) {
    return "This is a shelf registration — the company is setting up permission to sell securities later, not necessarily selling them all today.";
  }
  if (/^8-?K/i.test(f)) {
    return "This is a current report — the company is disclosing a material event (earnings, deal, leadership, etc.) to the SEC.";
  }
  if (/^4(\/A)?$/i.test(f) || f === "4") {
    return "This is an insider ownership report (Form 4) — officers/directors/large holders reporting buys, sells, or awards.";
  }
  if (/^425/i.test(f)) {
    return "This is a merger-related communication (Form 425) — materials about a proposed business combination.";
  }
  if (/(?:SC\s*13D|SCHEDULE\s*13D)/i.test(f)) {
    return "This is a Schedule 13D — an investor reporting a sizable active stake (often activist or control-seeking).";
  }
  if (/(?:SC\s*13G|SCHEDULE\s*13G)/i.test(f)) {
    return "This is a Schedule 13G — an investor reporting a sizable passive stake (typically not seeking control).";
  }
  return null;
}

/** Short label for split/meta chips. */
export function shortSecFormLabel(
  formType: string | null | undefined,
): string | null {
  const f = (formType ?? "").trim().toUpperCase();
  if (/^424B/i.test(f)) return "Pricing supplement / structured offering";
  if (/^S-3/i.test(f)) return "Shelf registration";
  if (/^8-?K/i.test(f)) return "Current report (8-K)";
  if (/^4(\/A)?$/i.test(f) || f === "4") return "Insider transaction (Form 4)";
  if (/^425/i.test(f)) return "Merger communication";
  if (/13D/i.test(f)) return "Active ownership (13D)";
  if (/13G/i.test(f)) return "Passive ownership (13G)";
  return null;
}
