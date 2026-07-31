/**
 * Strip upstream aggregator brand / host traces from PR-wire fields before
 * anything is persisted or shown. Product identity is always "PR Wire".
 */

/** Host tokens that must never appear in stored or displayed wire content. */
function blockedHostRe(): RegExp {
  return /\b(?:[\w-]+\.)*(?:rtpr)\.(?:io|com|net|org)\b/gi;
}

function blockedBrandRe(): RegExp {
  return /\brtpr\b/gi;
}

function blockedUrlRe(): RegExp {
  return /https?:\/\/(?:[\w.-]*\.)?rtpr\.(?:io|com|net|org)[^\s"'<>)]*/gi;
}

/** True when a string still contains a blocked upstream brand/host. */
export function containsBlockedWireTrace(value: string): boolean {
  return (
    blockedHostRe().test(value) ||
    blockedBrandRe().test(value) ||
    blockedUrlRe().test(value)
  );
}

/**
 * Remove blocked hosts, brand tokens, and upstream permalinks from free text.
 * Safe to run on titles, bodies, authors, and HTML.
 */
export function sanitizePrWireText(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") return null;
  let out = value;
  out = out.replace(blockedUrlRe(), "");
  out = out.replace(blockedHostRe(), "");
  out = out.replace(blockedBrandRe(), "");
  // Collapse leftover empty " — " / "| " chrome after stripping.
  out = out
    .replace(/\s*[|—–-]\s*(?=[|—–-]|$)/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return out || null;
}

/**
 * Keep only known wire publishers (Business Wire, etc.). Anything that looks
 * like the aggregator brand becomes the product label "PR Wire".
 */
export function sanitizePrWirePublisher(
  author: string | null | undefined,
): string {
  const cleaned = sanitizePrWireText(author);
  if (!cleaned) return "PR Wire";
  if (/^pr\s*wire$/i.test(cleaned)) return "PR Wire";
  return cleaned;
}

/** Drop image URLs hosted on blocked upstream domains. */
export function sanitizePrWireImageUrl(
  url: string | null | undefined,
): string | null {
  const t = url?.trim();
  if (!t || !/^https?:\/\//i.test(t)) return null;
  if (containsBlockedWireTrace(t)) return null;
  return t;
}
